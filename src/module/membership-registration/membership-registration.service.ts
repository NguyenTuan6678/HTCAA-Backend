import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Subject } from 'rxjs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';

import { MembershipRegistration } from '../../schema/membership-registration.schema';
import { Member } from '../../schema/member.schema';
import { Counter } from '../../schema/counter.schema';
import { User } from '../../schema/user.schema';
import { Role } from '../../utils/role.enum';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { escapeRegex } from '../../utils/escape-regex';
import { CreateMembershipRegistrationDto } from './dto/create-membership-registration.req';
import { QueryMembershipRegistrationDto } from './dto/query-membership-registration.req';
import { UpdateMembershipRegistrationDto } from './dto/update-membership-registration.req';
import { ConfirmPaymentDto } from './dto/confirm-payment.req';
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

  private async generateCertificatePdfBuffer(
    name: string,
    memberCode: string,
    memberType: MembershipType,
    issueDate: Date,
  ): Promise<Buffer> {
    // 1. Generate QR Code
    const verifyUrl = `https://htcaa.vn/verify-member?code=${memberCode}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

    // 2. Create PDF document
    const pdfDoc = await PDFDocument.create();
    // Landscape A4: 842 x 595
    const page = pdfDoc.addPage([842, 595]);

    // Embed standard fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(
      StandardFonts.HelveticaBold,
    );

    // Embed QR Code png image
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    // Draw borders (gold border)
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 802,
      height: 555,
      borderColor: rgb(0.85, 0.65, 0.13), // Gold
      borderWidth: 3,
    });
    page.drawRectangle({
      x: 25,
      y: 25,
      width: 792,
      height: 545,
      borderColor: rgb(0.85, 0.65, 0.13),
      borderWidth: 1,
    });

    // Draw Header Text (HTCAA) - strip accents to avoid Helvetica render crashes
    page.drawText('HOI TIN HOC VA CAC THANH VIEN HTCAA', {
      x: 50,
      y: 500,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.2, 0.5), // Dark Blue
    });

    page.drawText('HTCAA COMPUTER ASSOCIATION', {
      x: 50,
      y: 475,
      size: 13,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Draw Title
    page.drawText('GIAY CHUNG NHAN HOI VIEN', {
      x: 240,
      y: 380,
      size: 26,
      font: helveticaBoldFont,
      color: rgb(0.8, 0.1, 0.1), // Crimson Red
    });

    page.drawText('MEMBERSHIP CERTIFICATE', {
      x: 320,
      y: 355,
      size: 14,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Recipient name label
    page.drawText('Chung nhan Hoi vien chinh thuc (Member Name):', {
      x: 260,
      y: 290,
      size: 14,
      font: helveticaFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Draw normalized name
    const asciiName = this.removeVietnameseTones(name).toUpperCase();
    page.drawText(asciiName, {
      x: 260,
      y: 250,
      size: 22,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Member Type
    let typeText = 'HOI VIEN CA NHAN (INDIVIDUAL MEMBER)';
    if (memberType === MembershipType.COLLECTIVE) {
      typeText = 'HOI VIEN TAP THE (COLLECTIVE MEMBER)';
    } else if (memberType === MembershipType.AFFILIATE) {
      typeText = 'HOI VIEN LIEN KET (AFFILIATE MEMBER)';
    }

    page.drawText(typeText, {
      x: 260,
      y: 215,
      size: 13,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Member details on the left
    page.drawText(`Ma hoi vien (ID): ${memberCode}`, {
      x: 50,
      y: 130,
      size: 13,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    const day = String(issueDate.getDate()).padStart(2, '0');
    const month = String(issueDate.getMonth() + 1).padStart(2, '0');
    const year = issueDate.getFullYear();
    page.drawText(`Ngay cap (Issue Date): ${day}/${month}/${year}`, {
      x: 50,
      y: 105,
      size: 12,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Draw QR Code on the bottom right
    page.drawImage(qrImage, {
      x: 650,
      y: 50,
      width: 120,
      height: 120,
    });

    page.drawText('Quet de xac thuc', {
      x: 665,
      y: 35,
      size: 9,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // President Signature Area
    page.drawText('CHU TICH HOI', {
      x: 450,
      y: 130,
      size: 13,
      font: helveticaBoldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText('(Signature & Seal)', {
      x: 450,
      y: 115,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawLine({
      start: { x: 440, y: 70 },
      end: { x: 560, y: 70 },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  // ─── CORE LOGIC ─────────────────────────────────────────────────────────────

  async checkExists(query: CheckExistsDto) {
    const { email, phoneNumber } = query;
    if (!email && !phoneNumber) {
      throw new BadRequestException(
        'Vui lòng cung cấp email hoặc số điện thoại để kiểm tra.',
      );
    }

    let emailExists = false;
    let phoneExists = false;

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

    return {
      code: ERROR_RES.SUCCESS.statusCode,
      info: ERROR_INFO.SUCCESS,
      message: 'Kiểm tra thông tin trùng lặp hoàn tất',
      content: { emailExists, phoneExists },
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

      // 1. Check duplicate email/phone
      const cleanEmail = dto.email.toLowerCase().trim();
      const cleanPhone = dto.phoneNumber.trim();

      const [
        existingMemberEmail,
        existingRegEmail,
        existingMemberPhone,
        existingRegPhone,
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
      ]);

      if (existingMemberEmail || existingRegEmail) {
        errors.push(
          'Email này đã được đăng ký hoặc đang trong quá trình xét duyệt.',
        );
      }
      if (existingMemberPhone || existingRegPhone) {
        errors.push(
          'Số điện thoại này đã được sử dụng hoặc đang trong quá trình xét duyệt.',
        );
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
      const supplementToken =
        errors.length > 0 ? crypto.randomBytes(32).toString('hex') : null;
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
        supplementToken,
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
        this.mailService
          .sendSupplementRequestEmail(
            dto.email,
            dto.name,
            supplementToken!,
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
            ? 'Đăng ký hội viên thành công nhưng hồ sơ cần bổ sung. Vui lòng kiểm tra email.'
            : 'Đăng ký hội viên thành công. Hồ sơ đã chuyển đến hàng đợi xét duyệt.',
        content: {
          registration: resultWithUrls,
          errors: errors.length > 0 ? errors : null,
        },
      };
    } catch (error: any) {
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
        'Không tìm thấy hồ sơ hoặc token bổ sung không hợp lệ.',
      );
    }

    const registrationWithUrls = await this.attachFileUrls(registration);

    return {
      code: ERROR_RES.SUCCESS.statusCode,
      info: ERROR_INFO.SUCCESS,
      message: 'Lấy thông tin bổ sơ hồ sơ thành công',
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
        'Không tìm thấy đơn đăng ký tương ứng hoặc token không hợp lệ.',
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
          ? 'Cập nhật bổ sung hồ sơ thành công. Hồ sơ đã chuyển đến hàng đợi xét duyệt.'
          : 'Hồ sơ cập nhật chưa đầy đủ lỗi. Vui lòng điều chỉnh theo hướng dẫn.',
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
          message: 'Đơn đăng ký hội viên này đã được phê duyệt từ trước.',
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
          'Duyệt đơn đăng ký hội viên thành công. Email hướng dẫn thanh toán đã được gửi.',
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

  async confirmPayment(id: string, dto: ConfirmPaymentDto) {
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
          message: 'Không tìm thấy đơn đăng ký tương ứng',
          content: null,
        };
      }

      if (registration.paymentStatus === 'paid') {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message:
            'Đơn đăng ký hội viên này đã được đối soát xác nhận thanh toán trước đó.',
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
      const pdfBuffer = await this.generateCertificatePdfBuffer(
        registration.name,
        memberCode,
        registration.memberType as MembershipType,
        new Date(),
      );

      // 4. Upload Certificate to MinIO
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
      if (!member) {
        let dbMemberType = MemberType.INDIVIDUAL;
        if (registration.memberType === MembershipType.COLLECTIVE) {
          dbMemberType = MemberType.ORGANIZATION;
        } else if (registration.memberType === MembershipType.AFFILIATE) {
          dbMemberType = MemberType.AFFILIATE;
        }

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
          memberType: dbMemberType,
          organization:
            registration.memberType === MembershipType.COLLECTIVE
              ? {
                  name: registration.companyName,
                  taxCode: registration.taxCode,
                }
              : null,
          status: MemberStatus.ACTIVE,
          cpeHours: 0,
          certificateFile,
        });
      } else {
        member.memberCode = memberCode;
        member.status = MemberStatus.ACTIVE;
        member.certificateFile = certificateFile as any;
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
          'Xác nhận thanh toán thành công. Chứng nhận và thông tin tài khoản đã được cấp.',
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

      const deleted = await this.membershipRegistrationModel.findOneAndUpdate(
        { _id: new Types.ObjectId(id), isActive: true },
        { isActive: false },
        { returnDocument: 'after' },
      );

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
}
