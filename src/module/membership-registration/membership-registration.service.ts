import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Subject } from 'rxjs';
import { PDFDocument, rgb } from 'pdf-lib';
import * as fontkit from '@pdf-lib/fontkit';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

import { MembershipRegistration } from '../../schema/membership-registration.schema';
import { Member, MemberProfileFile } from '../../schema/member.schema';
import { Counter } from '../../schema/counter.schema';
import { User } from '../../schema/user.schema';
import { Role } from '../../utils/role.enum';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { escapeRegex } from '../../utils/escape-regex';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';
import { UpdateMembershipRegistrationDto } from './dto/update-membership-registration.req';
import { ConfirmPaymentDto } from './dto/confirm-payment.req';
import { CustomCertificateDto } from './dto/custom-certificate.req';
import { RequestSupplementDto } from './dto/request-supplement.req';
import { MembershipRegistrationSupplement } from '../../schema/membership-registration-supplement.schema';
import { MinioService } from '../minio/minio.service';
import { MailService } from '../mail/mail.service';
import { MembershipType } from '../../utils/membership-type.enum';
import { CheckExistsDto } from './dto/check-exists.req';
import { MemberType } from '../../utils/member-type.enum';
import { MemberStatus } from '../../utils/member-status.enum';

@Injectable()
export class MembershipRegistrationService {
  private readonly registrationNotifications$ = new Subject<any>();

  constructor(
    @InjectModel(MembershipRegistration.name)
    private readonly membershipRegistrationModel: Model<MembershipRegistration>,
    @InjectModel(Member.name)
    private readonly memberModel: Model<Member>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<Counter>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(MembershipRegistrationSupplement.name)
    private readonly supplementModel: Model<MembershipRegistrationSupplement>,
    private readonly minioService: MinioService,
    private readonly mailService: MailService,
  ) {}

  getNotificationStream() {
    return this.registrationNotifications$.asObservable();
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  private async attachFileUrls(registration: any) {
    if (!registration) return registration;
    const obj =
      typeof registration.toObject === 'function'
        ? registration.toObject()
        : registration;

    if (obj.avatar?.objectName) {
      try {
        obj.avatar = await this.minioService.attachPresignedUrl(obj.avatar);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for avatar ${obj.avatar?.objectName}:`,
          err.message,
        );
      }
    }

    if (obj.banner?.objectName) {
      try {
        obj.banner = await this.minioService.attachPresignedUrl(obj.banner);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for banner ${obj.banner?.objectName}:`,
          err.message,
        );
      }
    }

    if (obj.attachments && Array.isArray(obj.attachments)) {
      obj.attachments = await Promise.all(
        obj.attachments.map(async (file: any) => {
          try {
            return await this.minioService.attachPresignedUrl(file);
          } catch (err: any) {
            console.error(
              `Failed to generate presigned URL for attachment ${file.objectName}:`,
              err.message,
            );
            return file;
          }
        }),
      );
    }

    return obj;
  }

  private buildFileMetadata(uploadResult: any) {
    return {
      objectName: uploadResult.objectName,
      originalName: uploadResult.originalName,
      bucket: uploadResult.bucket || 'htcaa',
      mimetype: uploadResult.mimetype,
      size: uploadResult.size,
    };
  }

  private toMemberProfileFile(file?: any): MemberProfileFile | null {
    if (!file) {
      return null;
    }

    const filename = file.filename || file.objectName;
    if (!filename) {
      return null;
    }

    const path =
      file.path ||
      file.url ||
      `/uploads/members/${filename}`;

    return {
      originalName: file.originalName || file.originalname || filename,
      filename,
      path,
      mimetype: file.mimetype || file.mimeType || 'application/octet-stream',
      size: typeof file.size === 'number' ? file.size : 0,
    };
  }

  private async attachFileUrlsToList(registrations: any[]) {
    return Promise.all(registrations.map((r) => this.attachFileUrls(r)));
  }

  private async generateApplicationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const key = `REG${year}`;

    const counter = await this.counterModel.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    const seq = String(counter.seq).padStart(6, '0');
    return `HTCAA-${year}-${seq}`;
  }

  private removeVietnameseTones(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private splitTextIntoLines(text: string, maxLength = 38): string[] {
    if (text.includes('/')) {
      return text.split('/').map((s) => s.trim());
    }
    if (text.includes('\n')) {
      return text.split('\n').map((s) => s.trim());
    }
    if (text.length <= maxLength) {
      return [text];
    }
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      if ((line1 + ' ' + word).length <= maxLength && line2 === '') {
        line1 = line1 ? line1 + ' ' + word : word;
      } else {
        line2 = line2 ? line2 + ' ' + word : word;
      }
    }
    return line2 ? [line1, line2] : [line1];
  }

  private async generateCertificatePdfBuffer(
    name: string,
    memberCode: string,
    memberType: MembershipType,
    issueDate: Date,
    customLayout?: {
      recipientName?: { x?: number; y?: number; fontSize?: number };
      dateText?: { paddingRight?: number; y?: number; fontSize?: number };
      decisionNumber?: { x?: number; y?: number; fontSize?: number };
    },
    customDateText?: string,
    customDecisionNumberText?: string,
  ): Promise<Buffer> {
    // 1. Define layout positions on the 1920x1356 vector page space
    // Scale factor to map standard 842x595 coordinates to 1920x1355.8 coordinates
    const scaleFactor = 1920 / 842;
    const layout = {
      recipientName: {
        x: customLayout?.recipientName?.x
          ? customLayout.recipientName.x * scaleFactor
          : 960,
        y: customLayout?.recipientName?.y
          ? customLayout.recipientName.y * scaleFactor
          : 638,
        fontSize: customLayout?.recipientName?.fontSize
          ? customLayout.recipientName.fontSize * scaleFactor
          : 50,
        color: rgb(0, 84 / 255, 166 / 255),
      },
      dateText: {
        paddingRight: customLayout?.dateText?.paddingRight
          ? customLayout.dateText.paddingRight * scaleFactor
          : 195,
        y: customLayout?.dateText?.y
          ? customLayout.dateText.y * scaleFactor
          : 410,
        fontSize: customLayout?.dateText?.fontSize
          ? customLayout.dateText.fontSize * scaleFactor
          : 32,
        color: rgb(51 / 255, 65 / 255, 85 / 255),
      },
      decisionNumber: {
        x: customLayout?.decisionNumber?.x
          ? customLayout.decisionNumber.x * scaleFactor
          : 196,
        y: customLayout?.decisionNumber?.y
          ? customLayout.decisionNumber.y * scaleFactor
          : 200,
        fontSize: customLayout?.decisionNumber?.fontSize
          ? customLayout.decisionNumber.fontSize * scaleFactor
          : 32,
        color: rgb(15 / 255, 23 / 255, 42 / 255),
      },
    };

    // 2. Load background original vector template and custom fonts
    const templatePath = fs.existsSync(
      path.join(process.cwd(), 'src/assets/original_template.pdf'),
    )
      ? path.join(process.cwd(), 'src/assets/original_template.pdf')
      : path.join(__dirname, '../../assets/original_template.pdf');
    const bgBytes = fs.readFileSync(templatePath);

    // Project custom fonts path
    const fontsPath = fs.existsSync(
      path.join(process.cwd(), 'src/assets/fonts'),
    )
      ? path.join(process.cwd(), 'src/assets/fonts')
      : path.join(__dirname, '../../assets/fonts');

    // Times New Roman Bold for national motto
    const timesBoldBytes = fs.readFileSync(
      path.join(fontsPath, 'Times New Roman Bold.ttf'),
    );
    const beVietnamRegularBytes = fs.readFileSync(
      path.join(fontsPath, 'BeVietnamPro-Regular.ttf'),
    );
    const beVietnamBoldBytes = fs.readFileSync(
      path.join(fontsPath, 'BeVietnamPro-Bold.ttf'),
    );
    const beVietnamItalicBytes = fs.readFileSync(
      path.join(fontsPath, 'BeVietnamPro-Italic.ttf'),
    );
    const beVietnamExtraBoldBytes = fs.readFileSync(
      path.join(fontsPath, 'BeVietnamPro-ExtraBold.ttf'),
    );
    const beVietnamBlackBytes = fs.readFileSync(
      path.join(fontsPath, 'BeVietnamPro-Black.ttf'),
    );
    const luxuriousBytes = fs.readFileSync(
      path.join(fontsPath, 'LuxuriousScript-Regular.ttf'),
    );

    // 3. Load original vector PDF page
    const pdfDoc = await PDFDocument.load(bgBytes);
    pdfDoc.registerFontkit(fontkit);
    const pages = pdfDoc.getPages();
    const page = pages[0];

    const timesBold = await pdfDoc.embedFont(timesBoldBytes);
    const beVietnamRegular = await pdfDoc.embedFont(beVietnamRegularBytes);
    const beVietnamBold = await pdfDoc.embedFont(beVietnamBoldBytes);
    const beVietnamItalic = await pdfDoc.embedFont(beVietnamItalicBytes);
    const beVietnamExtraBold = await pdfDoc.embedFont(beVietnamExtraBoldBytes);
    const beVietnamBlack = await pdfDoc.embedFont(beVietnamBlackBytes);
    const luxuriousScript = await pdfDoc.embedFont(luxuriousBytes);

    // --- Draw white rectangles to cover original text ---
    const whiteColor = rgb(1, 1, 1);

    // 1. Cover motto (top right)
    page.drawRectangle({
      x: 750,
      y: 1115,
      width: 970,
      height: 110,
      color: whiteColor,
    });

    // 2. Cover header
    page.drawRectangle({
      x: 200,
      y: 895,
      width: 1520,
      height: 140,
      color: whiteColor,
    });

    // 2b. Cover original "Giấy Chứng Nhận" (to move it higher)
    page.drawRectangle({
      x: 400,
      y: 700,
      width: 1120,
      height: 160,
      color: whiteColor,
    });

    // 3. Cover company name
    page.drawRectangle({
      x: 200,
      y: 525,
      width: 1520,
      height: 180,
      color: whiteColor,
    });

    // 4. Cover description
    page.drawRectangle({
      x: 150,
      y: 480,
      width: 1600,
      height: 110,
      color: whiteColor,
    });

    // 5. Cover date
    page.drawRectangle({
      x: 900,
      y: 380,
      width: 900,
      height: 85,
      color: whiteColor,
    });

    // 6. Cover decision number (Số)
    page.drawRectangle({
      x: 190,
      y: 170,
      width: 510,
      height: 65,
      color: whiteColor,
    });

    // --- Draw new text on top ---

    // 1. Draw national motto (Times Bold) - Centered around separator center X=1203.5
    const motto1 = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    const motto2 = 'Độc lập - Tự do - Hạnh phúc';
    const mottoColor = rgb(0, 84 / 255, 166 / 255);

    const mottoWidth1 = timesBold.widthOfTextAtSize(motto1, 40);
    const mottoX1 = 1203.5 - mottoWidth1 / 2;
    page.drawText(motto1, {
      x: mottoX1,
      y: 1203,
      size: 40,
      font: timesBold,
      color: mottoColor,
    });

    const mottoWidth2 = timesBold.widthOfTextAtSize(motto2, 36);
    const mottoX2 = 1203.5 - mottoWidth2 / 2;
    page.drawText(motto2, {
      x: mottoX2,
      y: 1151,
      size: 36,
      font: timesBold,
      color: mottoColor,
    });

    // 2. Draw association header (Be Vietnam Pro)
    const header1 = 'HỘI TƯ VẤN VÀ ĐẠI LÝ THUẾ THÀNH PHỐ HỒ CHÍ MINH';
    const header2 = 'HO CHI MINH CITY TAX CONSULTANTS AND AGENTS ASSOCIATION';

    const headerWidth1 = beVietnamBlack.widthOfTextAtSize(header1, 50);
    const headerX1 = (1920 - headerWidth1) / 2;
    page.drawText(header1, {
      x: headerX1,
      y: 996,
      size: 50,
      font: beVietnamBlack,
      color: rgb(0, 84 / 255, 166 / 255),
    });

    const headerWidth2 = beVietnamRegular.widthOfTextAtSize(header2, 36);
    const headerX2 = (1920 - headerWidth2) / 2;
    page.drawText(header2, {
      x: headerX2,
      y: 933,
      size: 36,
      font: beVietnamRegular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // 2b. Draw "Giấy Chứng Nhận" elevated at Y=780 (Luxurious Script)
    const titleText = 'Giấy Chứng Nhận';
    const titleWidth = luxuriousScript.widthOfTextAtSize(titleText, 168.83);
    const titleX = (1920 - titleWidth) / 2;
    page.drawText(titleText, {
      x: titleX,
      y: 780,
      size: 168.83,
      font: luxuriousScript,
      color: rgb(237 / 255, 28 / 255, 36 / 255),
    });

    // 3. Draw Recipient Name / companyName (Be Vietnam Pro ExtraBold)
    const upperName = name.toUpperCase();
    const lines = this.splitTextIntoLines(upperName, 38);
    const nameColor = rgb(0, 84 / 255, 166 / 255);

    if (lines.length === 1) {
      const nameFontSize = layout.recipientName.fontSize;
      const nameWidth = beVietnamExtraBold.widthOfTextAtSize(
        lines[0],
        nameFontSize,
      );
      const nameX = (1920 - nameWidth) / 2;
      page.drawText(lines[0], {
        x: nameX,
        y: layout.recipientName.y,
        size: nameFontSize,
        font: beVietnamExtraBold,
        color: nameColor,
      });
    } else {
      // Line 1
      const fontSize1 = layout.recipientName.fontSize - 5;
      const nameWidth1 = beVietnamExtraBold.widthOfTextAtSize(
        lines[0],
        fontSize1,
      );
      const nameX1 = (1920 - nameWidth1) / 2;
      page.drawText(lines[0], {
        x: nameX1,
        y: layout.recipientName.y + 33,
        size: fontSize1,
        font: beVietnamExtraBold,
        color: nameColor,
      });
      // Line 2
      const fontSize2 = layout.recipientName.fontSize - 10;
      const nameWidth2 = beVietnamExtraBold.widthOfTextAtSize(
        lines[1],
        fontSize2,
      );
      const nameX2 = (1920 - nameWidth2) / 2;
      page.drawText(lines[1], {
        x: nameX2,
        y: layout.recipientName.y - 32,
        size: fontSize2,
        font: beVietnamExtraBold,
        color: nameColor,
      });
    }

    // 4. Draw Description (Be Vietnam Pro Bold)
    const desc =
      'Là Hội viên Chính thức của Hội Tư Vấn Và Đại Lý Thuế Thành phố Hồ Chí Minh';
    const descWidth = beVietnamBold.widthOfTextAtSize(desc, 40);
    const descX = (1920 - descWidth) / 2;
    page.drawText(desc, {
      x: descX,
      y: 523,
      size: 40,
      font: beVietnamBold,
      color: rgb(61 / 255, 61 / 255, 61 / 255),
    });

    // 5. Draw Issuance Date (Be Vietnam Pro Italic)
    const day = String(issueDate.getDate()).padStart(2, '0');
    const month = String(issueDate.getMonth() + 1).padStart(2, '0');
    const year = issueDate.getFullYear();
    const dateText =
      customDateText ??
      `Thành phố Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;
    const dateFontSize = layout.dateText.fontSize;
    const dateWidth = beVietnamItalic.widthOfTextAtSize(dateText, dateFontSize);
    const dateX = 1920 - dateWidth - layout.dateText.paddingRight;
    page.drawText(dateText, {
      x: dateX,
      y: layout.dateText.y,
      size: dateFontSize,
      font: beVietnamItalic,
      color: rgb(61 / 255, 61 / 255, 61 / 255),
    });

    // 6. Draw Decision Number (Be Vietnam Pro Regular)
    const numberText =
      customDecisionNumberText ??
      'Số: ...................................................';
    page.drawText(numberText, {
      x: layout.decisionNumber.x,
      y: layout.decisionNumber.y,
      size: layout.decisionNumber.fontSize,
      font: beVietnamRegular,
      color: rgb(61 / 255, 61 / 255, 61 / 255),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  // ─── CORE LOGIC ─────────────────────────────────────────────────────────────

  async checkExists(query: CheckExistsDto) {
    const { email, phoneNumber, taxCode, identityCode } = query;
    if (!email && !phoneNumber && !taxCode && !identityCode) {
      throw new BadRequestException(
        'Vui lòng cung cấp ít nhất một thông tin (email, số điện thoại, mã số thuế, căn cước công dân) để kiểm tra.',
      );
    }

    let emailExists = false;
    let phoneExists = false;
    let taxCodeExists = false;
    let identityCodeExists = false;

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const member = await this.memberModel.findOne({
        email: cleanEmail,
        isActive: true,
      });
      const reg = await this.membershipRegistrationModel.findOne({
        email: cleanEmail,
        status: { $in: ['pending', 'approved', 'need_info'] },
        isActive: true,
      });
      emailExists = !!(member || reg);
    }

    if (phoneNumber) {
      const cleanPhone = phoneNumber.trim();
      const member = await this.memberModel.findOne({
        phone: cleanPhone,
        isActive: true,
      });
      const reg = await this.membershipRegistrationModel.findOne({
        phoneNumber: cleanPhone,
        status: { $in: ['pending', 'approved', 'need_info'] },
        isActive: true,
      });
      phoneExists = !!(member || reg);
    }

    if (taxCode && taxCode.trim() !== '') {
      const cleanTaxCode = taxCode.trim();
      const member = await this.memberModel.findOne({
        'organization.taxCode': cleanTaxCode,
        isActive: true,
      });
      const reg = await this.membershipRegistrationModel.findOne({
        taxCode: cleanTaxCode,
        status: { $in: ['pending', 'approved', 'need_info'] },
        isActive: true,
      });
      taxCodeExists = !!(member || reg);
    }

    if (identityCode && identityCode.trim() !== '') {
      const cleanIdentityCode = identityCode.trim();
      const reg = await this.membershipRegistrationModel.findOne({
        identityCode: cleanIdentityCode,
        status: { $in: ['pending', 'approved', 'need_info'] },
        isActive: true,
      });
      identityCodeExists = !!reg;
    }

    return {
      code: ERROR_RES.SUCCESS.statusCode,
      info: ERROR_INFO.SUCCESS,
      message: 'Check duplicate information completed',
      content: { emailExists, phoneExists, taxCodeExists, identityCodeExists },
    };
  }

  async create(
    dto: CreateMembershipRegistrationDto,
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
      attachments?: Express.Multer.File[];
    },
  ) {
    try {
      const errors: string[] = [];

      // 1. Check duplicate email/phone/taxCode/identityCode
      const cleanEmail = dto.email.toLowerCase().trim();
      const cleanPhone = dto.phoneNumber.trim();
      const cleanTaxCode = dto.taxCode ? dto.taxCode.trim() : '';
      const cleanIdentityCode = dto.identityCode ? dto.identityCode.trim() : '';

      const [
        existingMemberEmail,
        existingRegEmail,
        existingMemberPhone,
        existingRegPhone,
        existingMemberTaxCode,
        existingRegTaxCode,
        existingRegIdentityCode,
      ] = await Promise.all([
        this.memberModel.findOne({ email: cleanEmail, isActive: true }),
        this.membershipRegistrationModel.findOne({
          email: cleanEmail,
          status: { $in: ['pending', 'need_info', 'approved'] },
          isActive: true,
        }),
        this.memberModel.findOne({ phone: cleanPhone, isActive: true }),
        this.membershipRegistrationModel.findOne({
          phoneNumber: cleanPhone,
          status: { $in: ['pending', 'need_info', 'approved'] },
          isActive: true,
        }),
        cleanTaxCode
          ? this.memberModel.findOne({
              'organization.taxCode': cleanTaxCode,
              isActive: true,
            })
          : null,
        cleanTaxCode
          ? this.membershipRegistrationModel.findOne({
              taxCode: cleanTaxCode,
              status: { $in: ['pending', 'need_info', 'approved'] },
              isActive: true,
            })
          : null,
        cleanIdentityCode
          ? this.membershipRegistrationModel.findOne({
              identityCode: cleanIdentityCode,
              status: { $in: ['pending', 'need_info', 'approved'] },
              isActive: true,
            })
          : null,
      ]);

      const duplicateErrors: string[] = [];
      if (existingMemberEmail || existingRegEmail) {
        duplicateErrors.push(
          'Email này đã được đăng ký hoặc đang trong quá trình xét duyệt.',
        );
      }
      if (existingMemberPhone || existingRegPhone) {
        duplicateErrors.push(
          'Số điện thoại này đã được sử dụng hoặc đang trong quá trình xét duyệt.',
        );
      }
      if (cleanTaxCode && (existingMemberTaxCode || existingRegTaxCode)) {
        duplicateErrors.push(
          'Mã số thuế này đã được đăng ký hoặc đang trong quá trình xét duyệt.',
        );
      }
      if (cleanIdentityCode && existingRegIdentityCode) {
        duplicateErrors.push(
          'Căn cước công dân (identityCode) này đã được đăng ký hoặc đang trong quá trình xét duyệt.',
        );
      }

      if (duplicateErrors.length > 0) {
        throw new BadRequestException(duplicateErrors.join(' '));
      }

      // 2. Validate dynamic fields for collective member
      if (dto.memberType === MembershipType.COLLECTIVE) {
        if (!dto.companyName?.trim()) {
          errors.push(
            'Đối với hội viên Tổ chức, bắt buộc phải nhập Tên công ty.',
          );
        }
        if (!dto.taxCode?.trim()) {
          errors.push(
            'Đối với hội viên Tổ chức, bắt buộc phải nhập Mã số thuế.',
          );
        }
      }

      // Validate professional certification field
      const isProfessional =
        dto.isProfessionalCertification === true ||
        (typeof dto.isProfessionalCertification === 'string' &&
          dto.isProfessionalCertification === 'true');

      if (isProfessional) {
        if (!dto.professionalCertificationNumber?.trim()) {
          errors.push(
            'Đối với hội viên có Chứng chỉ hành nghề, bắt buộc phải nhập Số quyết định/Số chứng chỉ hành nghề.',
          );
        }
      }

      // 3. Check attachments constraints (max 5MB, correct formats: pdf, png, jpg)
      const allowedMimetypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxFileSize = 5 * 1024 * 1024; // 5MB

      if (files?.attachments?.length) {
        for (let i = 0; i < files.attachments.length; i++) {
          const file = files.attachments[i];
          if (!allowedMimetypes.includes(file.mimetype)) {
            errors.push(
              `Tài liệu đính kèm "${file.originalname}" không đúng định dạng (Chỉ cho phép .pdf, .png, .jpg).`,
            );
          }
          if (file.size > maxFileSize) {
            errors.push(
              `Tài liệu đính kèm "${file.originalname}" vượt quá dung lượng tối đa (tối đa 5MB).`,
            );
          }
        }
      } else {
        errors.push(
          'Vui lòng tải lên ít nhất 1 tài liệu đính kèm (hồ sơ chứng nhận, giấy tờ liên quan).',
        );
      }

      // 4. Calculate fee
      let fee = 0;
      if (dto.memberType === MembershipType.INDIVIDUAL) {
        fee = 1200000;
      } else if (dto.memberType === MembershipType.COLLECTIVE) {
        fee = 3600000;
      } else if (dto.memberType === MembershipType.AFFILIATE) {
        fee = 0; // Agreement (Thoả thuận)
      }

      // 5. Calculate priority
      let priority = 'medium';
      if (
        dto.memberType === MembershipType.COLLECTIVE ||
        dto.memberType === MembershipType.AFFILIATE ||
        dto.isProfessionalCertification === true ||
        (typeof dto.isProfessionalCertification === 'string' &&
          dto.isProfessionalCertification === 'true')
      ) {
        priority = 'high';
      }

      // Upload files
      let avatarFile: any = null;
      if (files?.avatar) {
        const uploadResult = await this.minioService.uploadFile(
          files.avatar,
          'membership-registrations/avatars',
        );
        avatarFile = this.buildFileMetadata(uploadResult);
      }

      let bannerFile: any = null;
      if (files?.banner) {
        const uploadResult = await this.minioService.uploadFile(
          files.banner,
          'membership-registrations/banners',
        );
        bannerFile = this.buildFileMetadata(uploadResult);
      }

      const attachmentsMetadata: any[] = [];
      if (files?.attachments?.length) {
        for (const file of files.attachments) {
          try {
            const uploadResult = await this.minioService.uploadFile(
              file,
              'membership-registrations/attachments',
            );
            attachmentsMetadata.push(this.buildFileMetadata(uploadResult));
          } catch (err: any) {
            console.error(
              `Failed to upload attachment ${file.originalname}:`,
              err.message,
            );
          }
        }
      }

      // Determine status and tokens based on auto validation results
      const status = errors.length > 0 ? 'need_info' : 'pending';
      const validationNotes = errors.length > 0 ? errors.join('\n') : null;

      const registration = await this.membershipRegistrationModel.create({
        name: dto.name,
        memberType: dto.memberType,
        address: dto.address,
        taxCode: dto.taxCode ?? '',
        identityCode: dto.identityCode,
        job: dto.job,
        position: dto.position,
        dateOfBirth: new Date(dto.dateOfBirth),
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        status,
        fee,
        priority,
        attachments: attachmentsMetadata,
        supplementToken: null,
        validationNotes,
        joinAt: null,
        avatar: avatarFile,
        isProfessionalCertification: dto.isProfessionalCertification,
        professionalCertificationNumber:
          dto.professionalCertificationNumber ?? '',
        companyName: dto.companyName ?? '',
        companyLicense: dto.companyLicense ?? null,
        companyWebsiteUrl: dto.companyWebsiteUrl ?? null,
        companyPhoneNumber: dto.companyPhoneNumber ?? null,
        companyJobType: dto.companyJobType ?? null,
        companySlogan: dto.companySlogan ?? null,
        introduceBy: dto.introduceBy ?? null,
        banner: bannerFile,
        paymentStatus: 'unpaid',
        paymentMethod: 'none',
        amountPaid: 0,
        isActive: true,
      });

      const resultWithUrls = await this.attachFileUrls(registration);

      // Async hooks: email / real-time notifications
      if (status === 'need_info') {
        const missingFields: string[] = [];
        for (const err of errors) {
          if (err.includes('Tên công ty')) missingFields.push('companyName');
          if (err.includes('Mã số thuế')) missingFields.push('taxCode');
          if (err.includes('Chứng chỉ hành nghề'))
            missingFields.push('professionalCertificationNumber');
          if (err.includes('chân dung')) missingFields.push('avatar');
          if (err.includes('tài liệu đính kèm') || err.includes('giấy phép'))
            missingFields.push('attachments');
        }
        if (missingFields.length === 0) {
          missingFields.push('attachments');
        }

        const supplement = await this.supplementModel.create({
          registrationId: registration._id,
          missingFields,
          adminNotes: validationNotes || 'Hồ sơ thiếu thông tin bắt buộc.',
          status: 'pending',
        });

        this.mailService
          .sendSupplementRequestEmail(
            dto.email,
            dto.name,
            supplement._id.toString(),
            validationNotes!,
          )
          .catch((err) =>
            console.error(
              `Failed to send supplement email to ${dto.email}:`,
              err.message,
            ),
          );
      } else {
        this.registrationNotifications$.next({
          event: 'new-registration',
          data: {
            id: registration._id,
            name: registration.name,
            memberType: registration.memberType,
            priority: registration.priority,
            createdAt: registration.createdAt,
          },
        });
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message:
          status === 'need_info'
            ? 'Membership registration submitted successfully, but profile supplementation is required. Please check your email.'
            : 'Membership registration submitted successfully and placed in review queue.',
        content: {
          registration: resultWithUrls,
          errors: errors.length > 0 ? errors : null,
        },
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryMembershipRegistrationDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = { isActive: true };

      if (query.memberType) {
        filter.memberType = query.memberType;
      }

      if (query.status) {
        filter.status = query.status;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');
        filter.$or = [{ name: regex }, { address: regex }];
      }

      const [items, total] = await Promise.all([
        this.membershipRegistrationModel.aggregate([
          { $match: filter },
          {
            $addFields: {
              priorityWeight: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$priority', 'high'] }, then: 3 },
                    { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                    { case: { $eq: ['$priority', 'low'] }, then: 1 },
                  ],
                  default: 2,
                },
              },
            },
          },
          { $sort: { priorityWeight: -1, createdAt: 1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        this.membershipRegistrationModel.countDocuments(filter),
      ]);

      const itemsWithUrls = await this.attachFileUrlsToList(items);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get membership registrations successfully',
        content: {
          items: itemsWithUrls,
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting membership registrations: ${error.message}`,
        content: null,
      };
    }
  }

  async getSupplementByToken(token: string) {
    const registration = await this.membershipRegistrationModel.findOne({
      supplementToken: token,
      status: 'need_info',
      isActive: true,
    });

    if (!registration) {
      throw new NotFoundException(
        'Supplement record or token not found or invalid.',
      );
    }

    const registrationWithUrls = await this.attachFileUrls(registration);

    return {
      code: ERROR_RES.SUCCESS.statusCode,
      info: ERROR_INFO.SUCCESS,
      message: 'Get supplement information successfully',
      content: { registration: registrationWithUrls },
    };
  }

  async updateSupplementByToken(
    token: string,
    dto: UpdateMembershipRegistrationDto,
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
      attachments?: Express.Multer.File[];
    },
  ) {
    const existing = await this.membershipRegistrationModel.findOne({
      supplementToken: token,
      status: 'need_info',
      isActive: true,
    });

    if (!existing) {
      throw new NotFoundException(
        'Membership registration not found or token is invalid.',
      );
    }

    const mergedData = {
      ...existing.toObject(),
      ...dto,
    };

    const errors: string[] = [];

    const cleanEmail = mergedData.email.toLowerCase().trim();
    const cleanPhone = mergedData.phoneNumber.trim();

    if (cleanEmail !== existing.email.toLowerCase().trim()) {
      const [emailInMember, emailInReg] = await Promise.all([
        this.memberModel.findOne({ email: cleanEmail, isActive: true }),
        this.membershipRegistrationModel.findOne({
          email: cleanEmail,
          status: { $in: ['pending', 'approved'] },
          _id: { $ne: existing._id },
          isActive: true,
        }),
      ]);
      if (emailInMember || emailInReg) {
        errors.push('Email này đã được sử dụng bởi tài khoản khác.');
      }
    }

    if (cleanPhone !== existing.phoneNumber.trim()) {
      const [phoneInMember, phoneInReg] = await Promise.all([
        this.memberModel.findOne({ phone: cleanPhone, isActive: true }),
        this.membershipRegistrationModel.findOne({
          phoneNumber: cleanPhone,
          status: { $in: ['pending', 'approved'] },
          _id: { $ne: existing._id },
          isActive: true,
        }),
      ]);
      if (phoneInMember || phoneInReg) {
        errors.push('Số điện thoại này đã được sử dụng bởi tài khoản khác.');
      }
    }

    if (mergedData.memberType === MembershipType.COLLECTIVE) {
      if (!mergedData.companyName?.trim()) {
        errors.push(
          'Đối với hội viên Tổ chức, bắt buộc phải nhập Tên công ty.',
        );
      }
      if (!mergedData.taxCode?.trim()) {
        errors.push('Đối với hội viên Tổ chức, bắt buộc phải nhập Mã số thuế.');
      }
    }

    // Validate professional certification field
    const isProfessional =
      mergedData.isProfessionalCertification === true ||
      (typeof mergedData.isProfessionalCertification === 'string' &&
        mergedData.isProfessionalCertification === 'true');

    if (isProfessional) {
      if (!mergedData.professionalCertificationNumber?.trim()) {
        errors.push(
          'Đối với hội viên có Chứng chỉ hành nghề, bắt buộc phải nhập Số quyết định/Số chứng chỉ hành nghề.',
        );
      }
    }

    let finalAttachments = [...(existing.attachments || [])];
    const allowedMimetypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxFileSize = 5 * 1024 * 1024;

    if (files?.attachments?.length) {
      for (let i = 0; i < files.attachments.length; i++) {
        const file = files.attachments[i];
        if (!allowedMimetypes.includes(file.mimetype)) {
          errors.push(
            `Tài liệu đính kèm "${file.originalname}" không đúng định dạng (Chỉ cho phép .pdf, .png, .jpg).`,
          );
        }
        if (file.size > maxFileSize) {
          errors.push(
            `Tài liệu đính kèm "${file.originalname}" vượt quá dung lượng tối đa (tối đa 5MB).`,
          );
        }
      }

      if (errors.length === 0) {
        for (const file of existing.attachments) {
          if (file.objectName) {
            try {
              await this.minioService.removeFile(file.objectName);
            } catch (err: any) {
              console.error(
                `Failed to delete old attachment ${file.objectName}:`,
                err.message,
              );
            }
          }
        }
        const newAttachments: any[] = [];
        for (const file of files.attachments) {
          const uploadResult = await this.minioService.uploadFile(
            file,
            'membership-registrations/attachments',
          );
          newAttachments.push(this.buildFileMetadata(uploadResult));
        }
        finalAttachments = newAttachments;
      }
    } else if (finalAttachments.length === 0) {
      errors.push('Vui lòng tải lên ít nhất 1 tài liệu đính kèm.');
    }

    let avatarFile = existing.avatar;
    if (files?.avatar) {
      if (avatarFile?.objectName) {
        try {
          await this.minioService.removeFile(avatarFile.objectName);
        } catch (err: any) {
          console.error(
            `Failed to delete old avatar ${avatarFile.objectName}:`,
            err.message,
          );
        }
      }
      const uploadResult = await this.minioService.uploadFile(
        files.avatar,
        'membership-registrations/avatars',
      );
      avatarFile = this.buildFileMetadata(uploadResult);
    }

    let bannerFile = existing.banner;
    if (files?.banner) {
      if (bannerFile?.objectName) {
        try {
          await this.minioService.removeFile(bannerFile.objectName);
        } catch (err: any) {
          console.error(
            `Failed to delete old banner ${bannerFile.objectName}:`,
            err.message,
          );
        }
      }
      const uploadResult = await this.minioService.uploadFile(
        files.banner,
        'membership-registrations/banners',
      );
      bannerFile = this.buildFileMetadata(uploadResult);
    }

    const updateData: any = {
      name: mergedData.name,
      memberType: mergedData.memberType,
      address: mergedData.address,
      taxCode: mergedData.taxCode ?? '',
      identityCode: mergedData.identityCode,
      job: mergedData.job,
      position: mergedData.position,
      dateOfBirth: new Date(mergedData.dateOfBirth),
      phoneNumber: mergedData.phoneNumber,
      email: mergedData.email,
      avatar: avatarFile,
      banner: bannerFile,
      attachments: finalAttachments,
      isProfessionalCertification: mergedData.isProfessionalCertification,
      professionalCertificationNumber:
        mergedData.professionalCertificationNumber ?? '',
      companyName: mergedData.companyName ?? '',
      companyLicense: mergedData.companyLicense ?? null,
      companyWebsiteUrl: mergedData.companyWebsiteUrl ?? null,
      companyPhoneNumber: mergedData.companyPhoneNumber ?? null,
      companyJobType: mergedData.companyJobType ?? null,
      companySlogan: mergedData.companySlogan ?? null,
      introduceBy: mergedData.introduceBy ?? null,
    };

    if (mergedData.memberType === MembershipType.INDIVIDUAL) {
      updateData.fee = 1200000;
    } else if (mergedData.memberType === MembershipType.COLLECTIVE) {
      updateData.fee = 3600000;
    } else if (mergedData.memberType === MembershipType.AFFILIATE) {
      updateData.fee = 0;
    }

    if (
      mergedData.memberType === MembershipType.COLLECTIVE ||
      mergedData.memberType === MembershipType.AFFILIATE ||
      mergedData.isProfessionalCertification === true ||
      (typeof mergedData.isProfessionalCertification === 'string' &&
        mergedData.isProfessionalCertification === 'true')
    ) {
      updateData.priority = 'high';
    } else {
      updateData.priority = 'medium';
    }

    if (errors.length === 0) {
      updateData.status = 'pending';
      updateData.supplementToken = null;
      updateData.validationNotes = null;
    } else {
      updateData.validationNotes = errors.join('\n');
    }

    const updated = await this.membershipRegistrationModel.findOneAndUpdate(
      { _id: existing._id },
      updateData,
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new NotFoundException('Không tìm thấy đơn đăng ký để cập nhật.');
    }

    const resultWithUrls = await this.attachFileUrls(updated);

    if (errors.length === 0) {
      this.registrationNotifications$.next({
        event: 'new-registration',
        data: {
          id: updated._id,
          name: updated.name,
          memberType: updated.memberType,
          priority: updated.priority,
          createdAt: updated.createdAt,
        },
      });
    }

    return {
      code: ERROR_RES.SUCCESS.statusCode,
      info: ERROR_INFO.SUCCESS,
      message:
        errors.length === 0
          ? 'Supplement updated successfully and placed in review queue.'
          : 'Supplemented profile is incomplete. Please revise according to instructions.',
      content: {
        registration: resultWithUrls,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }

  async approve(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const existing = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existing) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      if (existing.status === 'approved') {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'This membership registration has already been approved.',
          content: null,
        };
      }

      const applicationCode = await this.generateApplicationCode();

      const updated = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        { status: 'approved', applicationCode, joinAt: new Date() },
        { returnDocument: 'after' },
      );

      const updatedWithUrls = await this.attachFileUrls(updated);

      this.mailService
        .sendApprovalNotificationEmail(
          existing.email,
          existing.name,
          applicationCode,
          existing.fee,
        )
        .catch((err) =>
          console.error(
            `Failed to send approval email to ${existing.email}:`,
            err.message,
          ),
        );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message:
          'Membership registration approved successfully. Payment instruction email has been sent.',
        content: { registration: updatedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while approving membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async resendPaymentNotification(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration ID',
          content: null,
        };
      }

      const existing = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existing) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      if (existing.status !== 'approved') {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            existing.status === 'payment_reconciled'
              ? 'This registration has already completed payment.'
              : 'Registration has not been approved yet. Cannot resend payment email.',
          content: null,
        };
      }

      let applicationCode = existing.applicationCode;
      if (!applicationCode) {
        applicationCode = await this.generateApplicationCode();
        existing.applicationCode = applicationCode;
        await existing.save();
      }

      await this.mailService.sendApprovalNotificationEmail(
        existing.email,
        existing.name,
        applicationCode,
        existing.fee,
      );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: `Payment instruction email has been resent to ${existing.email} successfully.`,
        content: { applicationCode },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Failed to resend payment instruction email: ${error.message}`,
        content: null,
      };
    }
  }

  async confirmPayment(
    id: string,
    dto: ConfirmPaymentDto,
    adminUserId?: string,
  ) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const registration = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      if (registration.paymentStatus === 'paid') {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'This membership registration payment has already been confirmed.',
          content: null,
        };
      }

      // 1. Update registration payment fields
      const updatedReg =
        await this.membershipRegistrationModel.findOneAndUpdate(
          { _id: registration._id },
          {
            paymentStatus: 'paid',
            paymentMethod: dto.paymentMethod,
            amountPaid: dto.amountPaid,
            paymentDate: new Date(),
          },
          { returnDocument: 'after' },
        );

      if (!updatedReg) {
        throw new NotFoundException(
          'Lỗi trong quá trình cập nhật trạng thái thanh toán.',
        );
      }

      // Mark all supplement requests as resolved
      await this.supplementModel.updateMany(
        {
          registrationId: registration._id,
          status: { $in: ['pending', 'submitted'] },
        },
        { status: 'resolved', resolvedAt: new Date() },
      );

      // 2. Generate Member Code: CN (Cá nhân), TT (Tổ chức), LK (Liên kết)
      let prefix = 'CN';
      if (registration.memberType === MembershipType.COLLECTIVE) {
        prefix = 'TT';
      } else if (registration.memberType === MembershipType.AFFILIATE) {
        prefix = 'LK';
      }

      const year = new Date().getFullYear();
      const counterKey = `MB_${prefix}_${year}`;

      const counter = await this.counterModel.findOneAndUpdate(
        { key: counterKey },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );

      const seq = String(counter.seq).padStart(4, '0');
      const memberCode = `HTCAA-${prefix}-${year}-${seq}`;

      // 3. Generate PDF Certificate
      const recipientName = registration.companyName || registration.name;

      const pdfBuffer = await this.generateCertificatePdfBuffer(
        recipientName,
        memberCode,
        registration.memberType as MembershipType,
        new Date(),
      );

      // 4. Upload Certificate (PDF) to MinIO
      const mockFile: any = {
        originalname: `Chung_nhan_HTCAA_${memberCode}.pdf`,
        buffer: pdfBuffer,
        size: pdfBuffer.length,
        mimetype: 'application/pdf',
      };
      const uploadResult = await this.minioService.uploadFile(
        mockFile,
        'members/certificates',
      );

      const certificateFile = {
        originalName: uploadResult.originalName,
        filename: uploadResult.objectName,
        path: `/uploads/members/${uploadResult.objectName}`,
        mimetype: uploadResult.mimetype,
        size: uploadResult.size,
      };

      // Export certificate in PNG and JPG formats using sips (macOS native)
      let certificateFilePng = null;
      let certificateFileJpg = null;

      const tempPdfPath = path.join(os.tmpdir(), `cert_${memberCode}.pdf`);
      const tempPngPath = path.join(os.tmpdir(), `cert_${memberCode}.png`);
      const tempJpgPath = path.join(os.tmpdir(), `cert_${memberCode}.jpg`);

      try {
        fs.writeFileSync(tempPdfPath, pdfBuffer);
        execSync(`sips -s format png "${tempPdfPath}" --out "${tempPngPath}"`);
        execSync(`sips -s format jpeg "${tempPdfPath}" --out "${tempJpgPath}"`);

        if (fs.existsSync(tempPngPath)) {
          const pngBuffer = fs.readFileSync(tempPngPath);
          const mockPngFile: any = {
            originalname: `Chung_nhan_HTCAA_${memberCode}.png`,
            buffer: pngBuffer,
            size: pngBuffer.length,
            mimetype: 'image/png',
          };
          const uploadPngResult = await this.minioService.uploadFile(
            mockPngFile,
            'members/certificates',
          );
          certificateFilePng = {
            originalName: uploadPngResult.originalName,
            filename: uploadPngResult.objectName,
            path: `/uploads/members/${uploadPngResult.objectName}`,
            mimetype: uploadPngResult.mimetype,
            size: uploadPngResult.size,
          };
          fs.unlinkSync(tempPngPath);
        }

        if (fs.existsSync(tempJpgPath)) {
          const jpgBuffer = fs.readFileSync(tempJpgPath);
          const mockJpgFile: any = {
            originalname: `Chung_nhan_HTCAA_${memberCode}.jpg`,
            buffer: jpgBuffer,
            size: jpgBuffer.length,
            mimetype: 'image/jpeg',
          };
          const uploadJpgResult = await this.minioService.uploadFile(
            mockJpgFile,
            'members/certificates',
          );
          certificateFileJpg = {
            originalName: uploadJpgResult.originalName,
            filename: uploadJpgResult.objectName,
            path: `/uploads/members/${uploadJpgResult.objectName}`,
            mimetype: uploadJpgResult.mimetype,
            size: uploadJpgResult.size,
          };
          fs.unlinkSync(tempJpgPath);
        }
      } catch (err: any) {
        console.error(
          'Failed to export certificate image formats:',
          err.message,
        );
      } finally {
        if (fs.existsSync(tempPdfPath)) {
          fs.unlinkSync(tempPdfPath);
        }
      }

      // 5. Create/Link User Account
      const cleanEmail = registration.email.toLowerCase().trim();
      let user = await this.userModel.findOne({ email: cleanEmail });

      const activationToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(activationToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (!user) {
        const tempPassword = crypto.randomBytes(16).toString('hex');
        user = await this.userModel.create({
          name: registration.name,
          email: cleanEmail,
          password: tempPassword,
          role: Role.MEMBER,
          isActive: true,
          memberType: registration.memberType,
          resetPasswordTokenHash: resetTokenHash,
          resetPasswordExpiresAt: expiresAt,
        });
      } else {
        user.role = Role.MEMBER;
        user.resetPasswordTokenHash = resetTokenHash;
        user.resetPasswordExpiresAt = expiresAt;
        await user.save();
      }

      // 6. Create/Update Member Profile
      let member = await this.memberModel.findOne({ userId: user._id });
      let dbMemberType = MemberType.INDIVIDUAL;
      if (registration.memberType === MembershipType.COLLECTIVE) {
        dbMemberType = MemberType.ORGANIZATION;
      } else if (registration.memberType === MembershipType.AFFILIATE) {
        dbMemberType = MemberType.AFFILIATE;
      }

      const organizationData = {
        name: registration.companyName || null,
        taxCode: registration.taxCode || null,
        employeeScale: null,
        license: registration.companyLicense || null,
        websiteUrl: registration.companyWebsiteUrl || null,
        phoneNumber: registration.companyPhoneNumber || null,
        jobType: registration.companyJobType || null,
        slogan: registration.companySlogan || null,
        banner: this.toMemberProfileFile(registration.banner),
      };

      const avatarData = this.toMemberProfileFile(registration.avatar);

      if (!member) {
        member = await this.memberModel.create({
          userId: user._id,
          memberCode,
          name: registration.name,
          dateOfBirth: registration.dateOfBirth,
          email: cleanEmail,
          phone: registration.phoneNumber,
          certificateNumber:
            registration.professionalCertificationNumber || 'HTCAA-CERT',
          workplace: registration.companyName || '',
          address: registration.address || null,
          identityCode: registration.identityCode || null,
          job: registration.job || null,
          position: registration.position || null,
          isProfessionalCertification: !!registration.isProfessionalCertification,
          introduceBy: registration.introduceBy || null,
          avatar: avatarData,
          memberType: dbMemberType,
          organization: organizationData,
          status: MemberStatus.ACTIVE,
          cpeHours: 0,
          certificateFile,
          certificateFilePng,
          certificateFileJpg,
          approvedAt: new Date(),
          approvedBy: adminUserId ? new Types.ObjectId(adminUserId) : null,
        });
      } else {
        member.memberCode = memberCode;
        member.status = MemberStatus.ACTIVE;
        member.name = registration.name || member.name;
        member.dateOfBirth = registration.dateOfBirth || member.dateOfBirth;
        member.phone = registration.phoneNumber || member.phone;
        member.address = registration.address || member.address;
        member.identityCode = registration.identityCode || member.identityCode;
        member.job = registration.job || member.job;
        member.position = registration.position || member.position;
        member.isProfessionalCertification =
          registration.isProfessionalCertification ?? member.isProfessionalCertification;
        member.introduceBy = registration.introduceBy || member.introduceBy;
        member.avatar = avatarData || member.avatar;
        member.workplace = registration.companyName || member.workplace;
        member.organization = organizationData;
        member.certificateFile = certificateFile as any;
        member.certificateFilePng = certificateFilePng as any;
        member.certificateFileJpg = certificateFileJpg as any;
        member.approvedAt = new Date();
        if (adminUserId) {
          member.approvedBy = new Types.ObjectId(adminUserId);
        }
        await member.save();
      }

      // 7. Send Activation & Certificate Email in Background
      this.mailService
        .sendCertificateEmail(
          cleanEmail,
          registration.name,
          memberCode,
          activationToken,
          pdfBuffer,
        )
        .catch((err) =>
          console.error(
            `Failed to send certificate email to ${cleanEmail}:`,
            err.message,
          ),
        );

      const resultWithUrls = await this.attachFileUrls(updatedReg);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message:
          'Payment confirmed successfully. Certificate and user account credentials have been issued.',
        content: { registration: resultWithUrls, memberCode },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while confirming payment: ${error.message}`,
        content: null,
      };
    }
  }

  async delete(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const deleted = await this.membershipRegistrationModel.findOneAndDelete({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!deleted) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const deletedWithUrls = await this.attachFileUrls(deleted);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete membership registration successfully',
        content: { registration: deletedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, dto: UpdateMembershipRegistrationDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const existing = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!existing) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const updateData: any = {};
      if (dto.starRating !== undefined) updateData.starRating = dto.starRating;
      if (dto.tenure !== undefined) updateData.tenure = dto.tenure;
      if (dto.tag !== undefined) updateData.tag = dto.tag;

      if (dto.avatarFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.avatarFile,
          'membership-registrations/avatars',
        );

        if ((existing as any).avatar?.objectName) {
          try {
            await this.minioService.removeFile(
              (existing as any).avatar.objectName,
            );
          } catch (err: any) {
            console.error(
              `Failed to remove old avatar ${(existing as any).avatar.objectName}:`,
              err.message,
            );
          }
        }

        updateData.avatar = this.buildFileMetadata(uploadResult);
      }

      if (dto.bannerFile) {
        const uploadResult = await this.minioService.uploadFile(
          dto.bannerFile,
          'membership-registrations/banners',
        );

        if ((existing as any).banner?.objectName) {
          try {
            await this.minioService.removeFile(
              (existing as any).banner.objectName,
            );
          } catch (err: any) {
            console.error(
              `Failed to remove old banner ${(existing as any).banner.objectName}:`,
              err.message,
            );
          }
        }

        updateData.banner = this.buildFileMetadata(uploadResult);
      }

      const updated = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        updateData,
        { returnDocument: 'after' },
      );

      if (!updated) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      const updatedWithUrls = await this.attachFileUrls(updated);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update membership registration successfully',
        content: { registration: updatedWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating membership registration: ${error.message}`,
        content: null,
      };
    }
  }

  async findHomepage(query: QueryMembershipRegistrationDto) {
    try {
      const registrations = await this.membershipRegistrationModel
        .find({ isActive: true, status: 'approved' })
        .sort({ joinAt: -1 })
        .limit(5);

      const registrationsWithUrls =
        await this.attachFileUrlsToList(registrations);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get homepage membership registrations successfully',
        content: { registrations: registrationsWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while getting homepage membership registrations: ${error.message}`,
        content: null,
      };
    }
  }

  async previewCustomCertificate(dto: CustomCertificateDto) {
    try {
      const memberCode = dto.memberCode || 'HTCAA-TT-2026-0001';
      const memberType = (dto.memberType || 'collective') as MembershipType;
      const pdfBuffer = await this.generateCertificatePdfBuffer(
        dto.name,
        memberCode,
        memberType,
        new Date(),
        dto.layout,
        dto.customDateText,
        dto.customDecisionNumberText,
      );

      let pngBase64 = null;
      let jpgBase64 = null;

      const tempPdfPath = path.join(os.tmpdir(), `preview_${Date.now()}.pdf`);
      const tempPngPath = path.join(os.tmpdir(), `preview_${Date.now()}.png`);
      const tempJpgPath = path.join(os.tmpdir(), `preview_${Date.now()}.jpg`);

      try {
        fs.writeFileSync(tempPdfPath, pdfBuffer);
        execSync(`sips -s format png "${tempPdfPath}" --out "${tempPngPath}"`);
        execSync(`sips -s format jpeg "${tempPdfPath}" --out "${tempJpgPath}"`);

        if (fs.existsSync(tempPngPath)) {
          pngBase64 = fs.readFileSync(tempPngPath).toString('base64');
          fs.unlinkSync(tempPngPath);
        }
        if (fs.existsSync(tempJpgPath)) {
          jpgBase64 = fs.readFileSync(tempJpgPath).toString('base64');
          fs.unlinkSync(tempJpgPath);
        }
      } catch (err: any) {
        console.error(
          'Failed to export preview images using sips:',
          err.message,
        );
      } finally {
        if (fs.existsSync(tempPdfPath)) {
          fs.unlinkSync(tempPdfPath);
        }
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Certificate preview generated successfully.',
        content: {
          pdfBase64: pdfBuffer.toString('base64'),
          pngBase64,
          jpgBase64,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Failed to generate preview: ${error.message}`,
        content: null,
      };
    }
  }

  async previewCustomCertificatePdf(query: {
    name: string;
    memberCode?: string;
    memberType?: string;
    customDateText?: string;
    customDecisionNumberText?: string;
  }): Promise<Buffer> {
    const memberCode = query.memberCode || 'HTCAA-TT-2026-0001';
    const memberType = (query.memberType || 'collective') as MembershipType;
    return this.generateCertificatePdfBuffer(
      query.name,
      memberCode,
      memberType,
      new Date(),
      undefined,
      query.customDateText,
      query.customDecisionNumberText,
    );
  }

  async previewCertificatePdfById(id: string): Promise<Buffer> {
    const registration = await this.membershipRegistrationModel.findById(id);
    if (!registration) {
      throw new NotFoundException('Membership registration not found.');
    }
    const memberCode = 'HTCAA-PREVIEW-0001';
    const recipientName = registration.companyName || registration.name;
    return this.generateCertificatePdfBuffer(
      recipientName,
      memberCode,
      registration.memberType as MembershipType,
      registration.createdAt || new Date(),
    );
  }

  async requestSupplement(id: string, dto: RequestSupplementDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid membership registration id',
          content: null,
        };
      }

      const registration = await this.membershipRegistrationModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found',
          content: null,
        };
      }

      // Update registration status to need_info
      await this.membershipRegistrationModel.updateOne(
        { _id: registration._id },
        { status: 'need_info', validationNotes: dto.adminNotes },
      );

      // Create new supplement record
      const supplement = await this.supplementModel.create({
        registrationId: registration._id,
        missingFields: dto.missingFields,
        adminNotes: dto.adminNotes,
        status: 'pending',
      });

      // Send email
      this.mailService
        .sendSupplementRequestEmail(
          registration.email,
          registration.name,
          supplement._id.toString(),
          dto.adminNotes,
        )
        .catch((err) =>
          console.error(
            `Failed to send supplement email to ${registration.email}:`,
            err.message,
          ),
        );

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Supplementation request sent successfully.',
        content: { supplement },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `An error occurred while requesting supplementation: ${error.message}`,
        content: null,
      };
    }
  }

  async getSupplementByRecordId(recordId: string) {
    try {
      if (!Types.ObjectId.isValid(recordId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid supplement record ID',
          content: null,
        };
      }

      const supplement = await this.supplementModel.findById(recordId);
      if (!supplement) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Supplement request record not found or expired.',
          content: null,
        };
      }

      const registration = await this.membershipRegistrationModel.findOne({
        _id: supplement.registrationId,
        isActive: true,
      });

      if (!registration) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Membership registration not found.',
          content: null,
        };
      }

      const registrationWithUrls = await this.attachFileUrls(registration);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get supplement information successfully.',
        content: { supplement, registration: registrationWithUrls },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `An error occurred while getting supplement information: ${error.message}`,
        content: null,
      };
    }
  }

  async updateSupplementByRecordId(
    recordId: string,
    dto: UpdateMembershipRegistrationDto,
    files: {
      avatar?: Express.Multer.File;
      banner?: Express.Multer.File;
      attachments?: Express.Multer.File[];
    },
  ) {
    if (!Types.ObjectId.isValid(recordId)) {
      throw new BadRequestException('Invalid supplement record ID.');
    }

    const supplement = await this.supplementModel.findById(recordId);
    if (!supplement) {
      throw new NotFoundException('Supplement record not found.');
    }

    if (supplement.status !== 'pending') {
      throw new BadRequestException(
        'This supplement request has already been updated.',
      );
    }

    const existing = await this.membershipRegistrationModel.findOne({
      _id: supplement.registrationId,
      status: 'need_info',
      isActive: true,
    });

    if (!existing) {
      throw new NotFoundException(
        'Membership registration not found in need_info status.',
      );
    }

    const mergedData = {
      ...existing.toObject(),
      ...dto,
    };

    const errors: string[] = [];

    const cleanEmail = mergedData.email.toLowerCase().trim();
    const cleanPhone = mergedData.phoneNumber.trim();

    if (cleanEmail !== existing.email.toLowerCase().trim()) {
      const [emailInMember, emailInReg] = await Promise.all([
        this.memberModel.findOne({ email: cleanEmail, isActive: true }),
        this.membershipRegistrationModel.findOne({
          email: cleanEmail,
          status: { $in: ['pending', 'approved'] },
          _id: { $ne: existing._id },
          isActive: true,
        }),
      ]);
      if (emailInMember || emailInReg) {
        errors.push('Email này đã được sử dụng bởi tài khoản khác.');
      }
    }

    if (cleanPhone !== existing.phoneNumber.trim()) {
      const [phoneInMember, phoneInReg] = await Promise.all([
        this.memberModel.findOne({ phone: cleanPhone, isActive: true }),
        this.membershipRegistrationModel.findOne({
          phoneNumber: cleanPhone,
          status: { $in: ['pending', 'approved'] },
          _id: { $ne: existing._id },
          isActive: true,
        }),
      ]);
      if (phoneInMember || phoneInReg) {
        errors.push('Số điện thoại này đã được sử dụng bởi tài khoản khác.');
      }
    }

    if (mergedData.memberType === MembershipType.COLLECTIVE) {
      if (!mergedData.companyName?.trim()) {
        errors.push(
          'Đối với hội viên Tổ chức, bắt buộc phải nhập Tên công ty.',
        );
      }
      if (!mergedData.taxCode?.trim()) {
        errors.push('Đối với hội viên Tổ chức, bắt buộc phải nhập Mã số thuế.');
      }
    }

    const isProfessional =
      mergedData.isProfessionalCertification === true ||
      (typeof mergedData.isProfessionalCertification === 'string' &&
        mergedData.isProfessionalCertification === 'true');

    if (isProfessional) {
      if (!mergedData.professionalCertificationNumber?.trim()) {
        errors.push(
          'Đối với hội viên có Chứng chỉ hành nghề, bắt buộc phải nhập Số quyết định/Số chứng chỉ hành nghề.',
        );
      }
    }

    let finalAttachments = [...(existing.attachments || [])];
    const allowedMimetypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxFileSize = 5 * 1024 * 1024;

    if (files?.attachments?.length) {
      for (let i = 0; i < files.attachments.length; i++) {
        const file = files.attachments[i];
        if (!allowedMimetypes.includes(file.mimetype)) {
          errors.push(
            `Tài liệu đính kèm "${file.originalname}" không đúng định dạng (Chỉ cho phép .pdf, .png, .jpg).`,
          );
        }
        if (file.size > maxFileSize) {
          errors.push(
            `Tài liệu đính kèm "${file.originalname}" vượt quá dung lượng tối đa (tối đa 5MB).`,
          );
        }
      }

      if (errors.length === 0) {
        for (const file of existing.attachments) {
          if (file.objectName) {
            try {
              await this.minioService.removeFile(file.objectName);
            } catch (err: any) {
              console.error(
                `Failed to delete old attachment ${file.objectName}:`,
                err.message,
              );
            }
          }
        }
        const newAttachments: any[] = [];
        for (const file of files.attachments) {
          const uploadResult = await this.minioService.uploadFile(
            file,
            'membership-registrations/attachments',
          );
          newAttachments.push(this.buildFileMetadata(uploadResult));
        }
        finalAttachments = newAttachments;
      }
    } else if (finalAttachments.length === 0) {
      errors.push('Vui lòng tải lên ít nhất 1 tài liệu đính kèm.');
    }

    let avatarFile = existing.avatar;
    if (files?.avatar) {
      if (avatarFile?.objectName) {
        try {
          await this.minioService.removeFile(avatarFile.objectName);
        } catch (err: any) {
          console.error(
            `Failed to delete old avatar ${avatarFile.objectName}:`,
            err.message,
          );
        }
      }
      const uploadResult = await this.minioService.uploadFile(
        files.avatar,
        'membership-registrations/avatars',
      );
      avatarFile = this.buildFileMetadata(uploadResult);
    }

    let bannerFile = existing.banner;
    if (files?.banner) {
      if (bannerFile?.objectName) {
        try {
          await this.minioService.removeFile(bannerFile.objectName);
        } catch (err: any) {
          console.error(
            `Failed to delete old banner ${bannerFile.objectName}:`,
            err.message,
          );
        }
      }
      const uploadResult = await this.minioService.uploadFile(
        files.banner,
        'membership-registrations/banners',
      );
      bannerFile = this.buildFileMetadata(uploadResult);
    }

    const updateData: any = {
      name: mergedData.name,
      memberType: mergedData.memberType,
      address: mergedData.address,
      taxCode: mergedData.taxCode ?? '',
      identityCode: mergedData.identityCode,
      job: mergedData.job,
      position: mergedData.position,
      dateOfBirth: new Date(mergedData.dateOfBirth),
      phoneNumber: mergedData.phoneNumber,
      email: mergedData.email,
      avatar: avatarFile,
      banner: bannerFile,
      attachments: finalAttachments,
      isProfessionalCertification: mergedData.isProfessionalCertification,
      professionalCertificationNumber:
        mergedData.professionalCertificationNumber ?? '',
      companyName: mergedData.companyName ?? '',
      companyLicense: mergedData.companyLicense ?? null,
      companyWebsiteUrl: mergedData.companyWebsiteUrl ?? null,
      companyPhoneNumber: mergedData.companyPhoneNumber ?? null,
      companyJobType: mergedData.companyJobType ?? null,
      companySlogan: mergedData.companySlogan ?? null,
      introduceBy: mergedData.introduceBy ?? null,
    };

    if (mergedData.memberType === MembershipType.INDIVIDUAL) {
      updateData.fee = 1200000;
    } else if (mergedData.memberType === MembershipType.COLLECTIVE) {
      updateData.fee = 3600000;
    } else if (mergedData.memberType === MembershipType.AFFILIATE) {
      updateData.fee = 0;
    }

    if (
      mergedData.memberType === MembershipType.COLLECTIVE ||
      mergedData.memberType === MembershipType.AFFILIATE ||
      mergedData.isProfessionalCertification === true ||
      (typeof mergedData.isProfessionalCertification === 'string' &&
        mergedData.isProfessionalCertification === 'true')
    ) {
      updateData.priority = 'high';
    } else {
      updateData.priority = 'medium';
    }

    if (errors.length === 0) {
      updateData.status = 'pending';
      updateData.validationNotes = null;
    } else {
      updateData.validationNotes = errors.join('\n');
    }

    const updated = await this.membershipRegistrationModel.findOneAndUpdate(
      { _id: existing._id },
      updateData,
      { returnDocument: 'after' },
    );

    if (!updated) {
      throw new NotFoundException(
        'Membership registration not found to update.',
      );
    }

    if (errors.length === 0) {
      await this.supplementModel.findByIdAndUpdate(recordId, {
        status: 'submitted',
      });

      this.registrationNotifications$.next({
        event: 'new-registration',
        data: {
          id: updated._id,
          name: updated.name,
          memberType: updated.memberType,
          priority: updated.priority,
          createdAt: updated.createdAt,
        },
      });
    }

    const resultWithUrls = await this.attachFileUrls(updated);

    return {
      code: errors.length === 0 ? ERROR_RES.SUCCESS.statusCode : 400,
      info: errors.length === 0 ? ERROR_INFO.SUCCESS : ERROR_INFO.FAIL,
      message:
        errors.length === 0
          ? 'Supplement profile updated successfully.'
          : 'Supplement profile is incomplete. Please revise according to instructions.',
      content: {
        registration: resultWithUrls,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }
}
