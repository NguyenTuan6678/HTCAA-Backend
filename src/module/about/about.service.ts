import { Injectable, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { AboutSetting } from '../../schema/about-setting.schema';
import { MinioService } from '../minio/minio.service';
import { CreateExecutiveBoardDto } from './dto/create-excutive-board.req';
import { UpdateExecutiveBoardDto } from './dto/update-excutve-board.req';
import { UpdateIntroductionDto } from './dto/update-introduction.req';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class AboutService {
  constructor(
    @InjectModel(AboutSetting.name)
    private readonly aboutSettingModel: Model<AboutSetting>,

    private readonly minioService: MinioService,
  ) {}

  private async getOrCreateSetting() {
    let setting = await this.aboutSettingModel.findOne();

    if (!setting) {
      setting = await this.aboutSettingModel.create({
        introduction: {
          title: 'Giới thiệu',
          content: '',
        },
        executiveBoard: [],
      });
    }

    return setting;
  }

  async findPublic() {
    const setting = await this.getOrCreateSetting();

    const result = setting.toObject();

    result.executiveBoard = await Promise.all(
      result.executiveBoard.map(async (member) => {
        if (member.avatar?.objectName) {
          member.avatar = await this.minioService.attachPresignedUrl(
            member.avatar,
          );
        }

        return member;
      }),
    );

    result.executiveBoard.sort((a, b) => a.order - b.order);

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Get about page successfully',
      content: result,
    };
  }

  async updateIntroduction(dto: UpdateIntroductionDto) {
    const setting = await this.getOrCreateSetting();

    setting.introduction = {
      title: dto.title,
      content: dto.content,
    };

    await setting.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Update introduction successfully',
      content: setting,
    };
  }

  async createExecutiveBoard(dto: CreateExecutiveBoardDto) {
    const setting = await this.getOrCreateSetting();

    setting.executiveBoard.push({
      name: dto.name,
      position: dto.position,
      description: dto.description,
      order: dto.order ?? 0,
    } as any);

    await setting.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Create executive board member successfully',
      content: setting,
    };
  }

  async updateExecutiveBoard(memberId: string, dto: UpdateExecutiveBoardDto) {
    const setting = await this.getOrCreateSetting();

    const member = setting.executiveBoard.find(
      (item: any) => item._id.toString() === memberId,
    );

    if (!member) {
      throw new NotFoundException('Executive board member not found');
    }

    if (!member) {
      throw new NotFoundException('Executive board member not found');
    }

    if (dto.name !== undefined) {
      member.name = dto.name;
    }

    if (dto.position !== undefined) {
      member.position = dto.position;
    }

    if (dto.description !== undefined) {
      member.description = dto.description;
    }

    if (dto.order !== undefined) {
      member.order = dto.order;
    }

    await setting.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Update executive board member successfully',
      content: setting,
    };
  }

  async deleteExecutiveBoard(memberId: string) {
    const setting = await this.getOrCreateSetting();

    setting.executiveBoard = setting.executiveBoard.filter(
      (item) => item._id.toString() !== memberId,
    ) as any;

    await setting.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Delete executive board member successfully',
      content: null,
    };
  }

  async uploadAvatar(memberId: string, file: Express.Multer.File) {
    const setting = await this.getOrCreateSetting();

    const member = setting.executiveBoard.find(
      (item: any) => item._id.toString() === memberId,
    );

    if (!member) {
      throw new NotFoundException('Executive board member not found');
    }

    if (!member) {
      throw new NotFoundException('Executive board member not found');
    }

    const uploadedFile = await this.minioService.uploadFile(
      file,
      'about/executive-board',
    );

    member.avatar = uploadedFile;

    await setting.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Upload avatar successfully',
      content: member,
    };
  }
}
