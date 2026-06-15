import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AboutUs } from '../../schema/about-setting.schema';
import { UpdateAboutUsDto } from './dto/update-excutve-board.req';

@Injectable()
export class AboutUsService {
  constructor(
    @InjectModel(AboutUs.name)
    private readonly aboutUsModel: Model<AboutUs>,
  ) {}

  // Always work with a single document (singleton pattern, same as your original)
  private async getOrCreate(): Promise<AboutUs> {
    let doc = await this.aboutUsModel.findOne();

    if (!doc) {
      doc = await this.aboutUsModel.create({
        description: '',
        company_name: '',
        logo: '',
        email: '',
        address: '',
        phone: '',
        map: '',
        tag: '',
        facebook_link: '',
        youtube_link: '',
        zalo_link: '',
        leadership: {
          header: { eyebrow: '', title: '', description: '' },
          items: [],
        },
        mission: {
          header: { eyebrow: '', title: '', description: '' },
          items: [],
        },
        stats: {
          header: { eyebrow: '', title: '', description: '' },
          items: [],
        },
        timeline: {
          header: { eyebrow: '', title: '', description: '' },
          items: [],
          highlights: [],
        },
      });
    }

    return doc;
  }

  async findPublic() {
    const doc = await this.getOrCreate();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Get about us page successfully',
      content: doc.toObject(),
    };
  }

  async update(dto: UpdateAboutUsDto) {
    const doc = await this.getOrCreate();

    // Top-level scalar fields
    const scalarFields = [
      'description',
      'company_name',
      'logo',
      'email',
      'address',
      'phone',
      'map',
      'tag',
      'facebook_link',
      'youtube_link',
      'zalo_link',
    ] as const;

    for (const field of scalarFields) {
      if (dto[field] !== undefined) {
        (doc as any)[field] = dto[field];
      }
    }

    // Nested section fields — replace the whole section when provided
    const sectionFields = [
      'leadership',
      'mission',
      'stats',
      'timeline',
    ] as const;

    for (const section of sectionFields) {
      if (dto[section] !== undefined) {
        (doc as any)[section] = dto[section];
      }
    }

    // Tell Mongoose the nested objects changed (mixed-type safety)
    doc.markModified('leadership');
    doc.markModified('mission');
    doc.markModified('stats');
    doc.markModified('timeline');

    await doc.save();

    return {
      code: 200,
      info: 'SUCCESS',
      message: 'Update about us successfully',
      content: doc.toObject(),
    };
  }
}
