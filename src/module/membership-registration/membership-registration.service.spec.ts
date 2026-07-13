import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { MembershipRegistrationService } from './membership-registration.service';
import { MembershipRegistration } from '../../schema/membership-registration.schema';
import { Member } from '../../schema/member.schema';
import { Counter } from '../../schema/counter.schema';
import { User } from '../../schema/user.schema';
import { MinioService } from '../minio/minio.service';
import { MailService } from '../mail/mail.service';
import { MembershipType } from '../../utils/membership-type.enum';

describe('MembershipRegistrationService', () => {
  let service: MembershipRegistrationService;
  let registrationModel: jest.Mocked<Model<any>>;
  let memberModel: jest.Mocked<Model<any>>;
  let counterModel: jest.Mocked<Model<any>>;
  let userModel: jest.Mocked<Model<any>>;
  let minioService: jest.Mocked<MinioService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    const mockModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    const mockMinioService = {
      uploadFile: jest.fn().mockResolvedValue({
        objectName: 'mock-object',
        originalName: 'mock-file',
        bucket: 'htcaa',
        mimetype: 'image/png',
        size: 1000,
      }),
      removeFile: jest.fn().mockResolvedValue(undefined),
      attachPresignedUrl: jest.fn((val) => Promise.resolve({ ...val, url: 'http://mock-url' })),
    };

    const mockMailService = {
      sendSupplementRequestEmail: jest.fn().mockResolvedValue(undefined),
      sendApprovalNotificationEmail: jest.fn().mockResolvedValue(undefined),
      sendCertificateEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipRegistrationService,
        {
          provide: getModelToken(MembershipRegistration.name),
          useValue: { ...mockModel },
        },
        {
          provide: getModelToken(Member.name),
          useValue: { ...mockModel },
        },
        {
          provide: getModelToken(Counter.name),
          useValue: { ...mockModel },
        },
        {
          provide: getModelToken(User.name),
          useValue: { ...mockModel },
        },
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<MembershipRegistrationService>(MembershipRegistrationService);
    registrationModel = module.get(getModelToken(MembershipRegistration.name));
    memberModel = module.get(getModelToken(Member.name));
    counterModel = module.get(getModelToken(Counter.name));
    userModel = module.get(getModelToken(User.name));
    minioService = module.get(MinioService) as any;
    mailService = module.get(MailService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create - Automated Validation Flow', () => {
    const defaultDto = {
      name: 'Nguyễn Văn An',
      memberType: MembershipType.INDIVIDUAL,
      address: 'Hà Nội',
      identityCode: '123456789',
      job: 'Kế toán',
      position: 'Nhân viên',
      dateOfBirth: '1995-01-01',
      phoneNumber: '0901234567',
      email: 'test@example.com',
      isProfessionalCertification: false,
    };

    it('should create registration as "pending" if all info and attachments are valid', async () => {
      memberModel.findOne.mockResolvedValue(null);
      registrationModel.findOne.mockResolvedValue(null);
      (registrationModel.create as any).mockImplementation((data: any) =>
        Promise.resolve({
          ...data,
          _id: 'mock-id',
          createdAt: new Date(),
          toObject: () => ({ ...data, _id: 'mock-id', createdAt: new Date() }),
        }),
      );

      const files = {
        avatar: { mimetype: 'image/png', size: 1000, originalname: 'avatar.png', buffer: Buffer.from([]) } as any,
        attachments: [
          { mimetype: 'application/pdf', size: 2000, originalname: 'doc.pdf', buffer: Buffer.from([]) } as any,
        ],
      };

      const result = await service.create(defaultDto as any, files);

      expect(result.code).toBe(200);
      expect(result.content!.registration.status).toBe('pending');
      expect(result.content!.registration.fee).toBe(1200000);
      expect(result.content!.registration.priority).toBe('medium');
      expect(registrationModel.create).toHaveBeenCalled();
      expect(mailService.sendSupplementRequestEmail).not.toHaveBeenCalled();
    });

    it('should set status to "need_info" and generate token if attachments are missing', async () => {
      memberModel.findOne.mockResolvedValue(null);
      registrationModel.findOne.mockResolvedValue(null);
      (registrationModel.create as any).mockImplementation((data: any) =>
        Promise.resolve({
          ...data,
          _id: 'mock-id',
          createdAt: new Date(),
          toObject: () => ({ ...data, _id: 'mock-id', createdAt: new Date() }),
        }),
      );

      const files = {
        avatar: { mimetype: 'image/png', size: 1000, originalname: 'avatar.png', buffer: Buffer.from([]) } as any,
        attachments: [],
      };

      const result = await service.create(defaultDto as any, files);

      expect(result.code).toBe(200);
      expect(result.content!.registration.status).toBe('need_info');
      expect(result.content!.registration.supplementToken).toBeDefined();
      expect(mailService.sendSupplementRequestEmail).toHaveBeenCalled();
    });

    it('should set status to "need_info" if email is duplicate', async () => {
      memberModel.findOne.mockResolvedValue({ email: 'test@example.com' });
      registrationModel.findOne.mockResolvedValue(null);
      (registrationModel.create as any).mockImplementation((data: any) =>
        Promise.resolve({
          ...data,
          _id: 'mock-id',
          toObject: () => ({ ...data, _id: 'mock-id' }),
        }),
      );

      const files = {
        avatar: { mimetype: 'image/png', size: 1000, originalname: 'avatar.png', buffer: Buffer.from([]) } as any,
        attachments: [
          { mimetype: 'application/pdf', size: 2000, originalname: 'doc.pdf', buffer: Buffer.from([]) } as any,
        ],
      };

      const result = await service.create(defaultDto as any, files);

      expect(result.code).toBe(200);
      expect(result.content!.registration.status).toBe('need_info');
      expect(mailService.sendSupplementRequestEmail).toHaveBeenCalled();
    });
  });

  describe('approve - Manual Secretariat Approval', () => {
    it('should generate application code and call sendApprovalNotificationEmail', async () => {
      const mockReg = {
        _id: 'reg-id',
        name: 'Nguyễn Văn An',
        email: 'test@example.com',
        fee: 1200000,
        status: 'pending',
        toObject: () => ({
          _id: 'reg-id',
          name: 'Nguyễn Văn An',
          email: 'test@example.com',
          fee: 1200000,
          status: 'approved',
        }),
      };

      registrationModel.findOne.mockResolvedValue(mockReg);
      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 42 });
      registrationModel.findOneAndUpdate.mockResolvedValue(mockReg);

      const result = await service.approve('507f1f77bcf86cd799439011');

      expect(result.code).toBe(200);
      expect(registrationModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mailService.sendApprovalNotificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Nguyễn Văn An',
        expect.stringContaining('HTCAA-'),
        1200000,
      );
    });
  });

  describe('confirmPayment - Offline Reconciliation Flow', () => {
    it('should confirm payment, generate member code and create User/Member profile', async () => {
      const mockReg = {
        _id: 'reg-id',
        name: 'Nguyễn Văn An',
        email: 'test@example.com',
        phoneNumber: '0901234567',
        memberType: MembershipType.INDIVIDUAL,
        fee: 1200000,
        status: 'approved',
        paymentStatus: 'unpaid',
        dateOfBirth: new Date('1995-01-01'),
        professionalCertificationNumber: '',
        companyName: '',
        toObject: () => ({
          _id: 'reg-id',
          name: 'Nguyễn Văn An',
          email: 'test@example.com',
          phoneNumber: '0901234567',
          memberType: MembershipType.INDIVIDUAL,
          fee: 1200000,
          status: 'approved',
          paymentStatus: 'paid',
        }),
      };

      registrationModel.findOne.mockResolvedValue(mockReg);
      registrationModel.findOneAndUpdate.mockResolvedValue(mockReg);
      counterModel.findOneAndUpdate.mockResolvedValue({ seq: 214 });

      // Mock user & member models
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue({ _id: 'user-id' } as any);
      memberModel.findOne.mockResolvedValue(null);
      memberModel.create.mockResolvedValue({ _id: 'member-id' } as any);

      const dto = {
        paymentMethod: 'bank_transfer',
        amountPaid: 1200000,
        note: 'Đã nhận tiền',
      };

      const result = await service.confirmPayment('507f1f77bcf86cd799439011', dto);

      expect(result.code).toBe(200);
      expect(result.content!.memberCode).toContain('HTCAA-CN-');
      expect(userModel.create).toHaveBeenCalled();
      expect(memberModel.create).toHaveBeenCalled();
      expect(mailService.sendCertificateEmail).toHaveBeenCalled();
    });
  });
});
