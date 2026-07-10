import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Course } from '../../schema/course.schema';
import { User } from '../../schema/user.schema';
import { CourseCategory } from '../../schema/course-category.schema';
import { ERROR_INFO, ERROR_RES } from '../../constants/error.const';
import { CreateCourseDto } from './dto/create-course.req';
import { QueryCourseDto } from './dto/query-course.req';
import { CourseStatus } from '../../utils/course-status.enum';
import { CourseType } from '../../utils/course-type.enum';
import { UpdateCourseDto } from './dto/update-course.req';
import { CreateCourseCategoryDto } from './dto/create-course-category.req';
import { UpdateCourseCategoryDto } from './dto/update-course-category.req';
import { QueryCourseCategoryDto } from './dto/query-course-category.req';
import { escapeRegex } from '../../utils/escape-regex';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name)
    private readonly courseModel: Model<Course>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(CourseCategory.name)
    private readonly courseCategoryModel: Model<CourseCategory>,

    private readonly minioService: MinioService,
  ) {}

  private async attachImageUrl(course: any) {
    if (!course) return course;
    const obj =
      typeof course.toObject === 'function' ? course.toObject() : course;

    if (obj.image?.objectName) {
      try {
        obj.image = await this.minioService.attachPresignedUrl(obj.image);
      } catch (err: any) {
        console.error(
          `Failed to generate presigned URL for course image ${obj.image?.objectName}:`,
          err.message,
        );
      }
    }

    return obj;
  }

  private buildFileMetadata(uploadResult: any) {
    return {
      objectName: uploadResult.objectName,
      originalName: uploadResult.originalName,
      bucket: uploadResult.bucket || 'htcaa',
      mimetype: uploadResult.mimetype || uploadResult.mimeType,
      size: uploadResult.size,
    };
  }

  private async attachImageUrlsToList(courses: any[]) {
    return Promise.all(courses.map((course) => this.attachImageUrl(course)));
  }

  private normalizeVietnamese(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private slugify(value: string): string {
    return this.normalizeVietnamese(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async generateUniqueCourseSlug(title: string): Promise<string> {
    const baseSlug = this.slugify(title);
    let slug = baseSlug;
    let count = 1;

    while (await this.courseModel.exists({ slug })) {
      slug = `${baseSlug}-${count}`;
      count++;
    }

    return slug;
  }

  private getPopulateQueries() {
    return [
      {
        path: 'createdBy',
        model: User.name,
        select: 'name email role',
      },
      {
        path: 'categoryId',
        model: CourseCategory.name,
        select: 'name slug description',
      },
    ];
  }

  async create(userId: string, createCourseDto: CreateCourseDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid user id',
          content: null,
        };
      }

      const user = await this.userModel.findOne({
        _id: new Types.ObjectId(userId),
        isActive: true,
      });

      if (!user) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'User not found or inactive',
          content: null,
        };
      }

      let categoryIdObj: Types.ObjectId | null = null;
      if (createCourseDto.categoryId) {
        if (!Types.ObjectId.isValid(createCourseDto.categoryId)) {
          return {
            code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'Danh mục khóa học không hợp lệ',
            content: null,
          };
        }
        const categoryExists = await this.courseCategoryModel.findOne({
          _id: new Types.ObjectId(createCourseDto.categoryId),
          isActive: true,
        });
        if (!categoryExists) {
          return {
            code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'Danh mục khóa học không tồn tại hoặc đã bị ẩn',
            content: null,
          };
        }
        categoryIdObj = categoryExists._id;
      }

      const slug = await this.generateUniqueCourseSlug(createCourseDto.title);

      const course = await this.courseModel.create({
        createdBy: new Types.ObjectId(userId),
        title: createCourseDto.title,
        slug,
        date: new Date(createCourseDto.date),
        location: createCourseDto.location ?? null,
        image: createCourseDto.image
          ? this.buildFileMetadata(createCourseDto.image)
          : null,
        learningType: createCourseDto.learningType ?? null,
        duration: createCourseDto.duration ?? null,
        taxHours: createCourseDto.taxHours ?? 0,
        accountingHours: createCourseDto.accountingHours ?? 0,
        totalSeats: createCourseDto.totalSeats ?? null,
        price: createCourseDto.price ?? 0,
        memberPrice: createCourseDto.memberPrice,
        registeredSeats: 0,
        status: createCourseDto.status ?? CourseStatus.DRAFT,
        categoryId: categoryIdObj,
        type: createCourseDto.type ?? CourseType.OFFLINE,
        isActive: true,
      });

      const populatedCourse = await this.courseModel
        .findById(course._id)
        .populate(this.getPopulateQueries());

      const courseWithImage = await this.attachImageUrl(populatedCourse);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Create course successfully',
        content: {
          course: courseWithImage,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while creating course: ${error.message}`,
        content: null,
      };
    }
  }

  async findAll(query: QueryCourseDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = {
        isActive: true,
      };

      if (query.status) {
        filter.status = query.status;
      }

      if (query.categoryId) {
        filter.categoryId = new Types.ObjectId(query.categoryId);
      }

      if (query.type) {
        filter.type = query.type;
      }

      if (query.slug) {
        filter.slug = query.slug;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');

        filter.$or = [{ title: regex }, { location: regex }];
      }

      const [items, total] = await Promise.all([
        this.courseModel
          .find(filter)
          .populate(this.getPopulateQueries())
          .sort({ date: 1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.courseModel.countDocuments(filter),
      ]);

      const itemsWithImages = await this.attachImageUrlsToList(items as any[]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Get courses successfully',
        content: {
          items: itemsWithImages,
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
        message: `There is a problem while getting courses: ${error.message}`,
        content: null,
      };
    }
  }

  async update(id: string, updateCourseDto: UpdateCourseDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid course id',
          content: null,
        };
      }

      const course = await this.courseModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const updateData: any = {};

      if (updateCourseDto.title !== undefined) {
        updateData.title = updateCourseDto.title;

        if (updateCourseDto.title !== (course as any).title) {
          updateData.slug = await this.generateUniqueCourseSlug(
            updateCourseDto.title,
          );
        }
      }

      if (updateCourseDto.date !== undefined) {
        updateData.date = new Date(updateCourseDto.date);
      }

      if (updateCourseDto.location !== undefined) {
        updateData.location = updateCourseDto.location;
      }

      if (updateCourseDto.image !== undefined) {
        updateData.image = updateCourseDto.image
          ? this.buildFileMetadata(updateCourseDto.image)
          : null;
      }

      if (updateCourseDto.learningType !== undefined) {
        updateData.learningType = updateCourseDto.learningType;
      }

      if (updateCourseDto.duration !== undefined) {
        updateData.duration = updateCourseDto.duration;
      }

      if (updateCourseDto.taxHours !== undefined) {
        updateData.taxHours = updateCourseDto.taxHours;
      }

      if (updateCourseDto.accountingHours !== undefined) {
        updateData.accountingHours = updateCourseDto.accountingHours;
      }

      if (updateCourseDto.totalSeats !== undefined) {
        updateData.totalSeats = updateCourseDto.totalSeats;
      }

      if (updateCourseDto.price !== undefined) {
        updateData.price = updateCourseDto.price;
      }

      if (updateCourseDto.memberPrice !== undefined) {
        updateData.memberPrice = updateCourseDto.memberPrice;
      }

      if (updateCourseDto.status !== undefined) {
        updateData.status = updateCourseDto.status;
      }

      if (updateCourseDto.categoryId !== undefined) {
        if (!updateCourseDto.categoryId) {
          updateData.categoryId = null;
        } else {
          if (!Types.ObjectId.isValid(updateCourseDto.categoryId)) {
            return {
              code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
              info: ERROR_INFO.FAIL,
              message: 'Danh mục khóa học không hợp lệ',
              content: null,
            };
          }
          const categoryExists = await this.courseCategoryModel.findOne({
            _id: new Types.ObjectId(updateCourseDto.categoryId),
            isActive: true,
          });
          if (!categoryExists) {
            return {
              code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
              info: ERROR_INFO.FAIL,
              message: 'Danh mục khóa học không tồn tại hoặc đã bị ẩn',
              content: null,
            };
          }
          updateData.categoryId = categoryExists._id;
        }
      }

      if (updateCourseDto.type !== undefined) {
        updateData.type = updateCourseDto.type;
      }

      const updatedCourse = await this.courseModel
        .findByIdAndUpdate(id, updateData, {
          returnDocument: 'after',
          runValidators: true,
        })
        .populate(this.getPopulateQueries());

      const courseWithImage = await this.attachImageUrl(updatedCourse);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Update course successfully',
        content: {
          course: courseWithImage,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while updating course: ${error.message}`,
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
          message: 'Invalid course id',
          content: null,
        };
      }

      const deletedCourse = await this.courseModel
        .findOneAndUpdate(
          {
            _id: new Types.ObjectId(id),
            isActive: true,
          },
          {
            isActive: false,
          },
          {
            returnDocument: 'after',
          },
        )
        .populate(this.getPopulateQueries());

      if (!deletedCourse) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const courseWithImage = await this.attachImageUrl(deletedCourse);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Delete course successfully',
        content: {
          course: courseWithImage,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while deleting course: ${error.message}`,
        content: null,
      };
    }
  }

  // ==========================================
  // COURSE CATEGORY METHODS
  // ==========================================

  async createCategory(dto: CreateCourseCategoryDto) {
    try {
      const existing = await this.courseCategoryModel.findOne({
        slug: dto.slug,
      });
      if (existing) {
        return {
          code: ERROR_RES.CONFLICT_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Slug danh mục đã tồn tại',
          content: null,
        };
      }

      const category = await this.courseCategoryModel.create({
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      });

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Tạo danh mục khóa học thành công',
        content: { category },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Lỗi khi tạo danh mục: ${error.message}`,
        content: null,
      };
    }
  }

  async findCategories(query: QueryCourseCategoryDto) {
    try {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (query.isActive !== undefined) {
        filter.isActive = query.isActive;
      }

      if (query.q) {
        const escaped = escapeRegex(query.q);
        const regex = new RegExp(escaped, 'i');
        filter.$or = [{ name: regex }, { slug: regex }];
      }

      const [items, total] = await Promise.all([
        this.courseCategoryModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.courseCategoryModel.countDocuments(filter),
      ]);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Lấy danh sách danh mục khóa học thành công',
        content: {
          items,
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
        message: `Lỗi khi lấy danh sách danh mục: ${error.message}`,
        content: null,
      };
    }
  }

  async updateCategory(id: string, dto: UpdateCourseCategoryDto) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'ID danh mục không hợp lệ',
          content: null,
        };
      }

      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.slug !== undefined) {
        // check unique slug
        const existing = await this.courseCategoryModel.findOne({
          slug: dto.slug,
          _id: { $ne: new Types.ObjectId(id) },
        });
        if (existing) {
          return {
            code: ERROR_RES.CONFLICT_ERROR.statusCode,
            info: ERROR_INFO.FAIL,
            message: 'Slug danh mục đã tồn tại',
            content: null,
          };
        }
        updateData.slug = dto.slug;
      }
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      const category = await this.courseCategoryModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true },
      );

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Không tìm thấy danh mục khóa học',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Cập nhật danh mục khóa học thành công',
        content: { category },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Lỗi khi cập nhật danh mục: ${error.message}`,
        content: null,
      };
    }
  }

  async uploadImage(id: string, file: Express.Multer.File) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Invalid course id',
          content: null,
        };
      }

      const course = await this.courseModel.findOne({
        _id: new Types.ObjectId(id),
        isActive: true,
      });

      if (!course) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Course not found',
          content: null,
        };
      }

      const result = await this.minioService.uploadFile(file, 'courses/images');

      if (course.image?.objectName) {
        try {
          await this.minioService.removeFile(course.image.objectName);
        } catch (err: any) {
          console.error(
            `Failed to remove old course image ${course.image.objectName}:`,
            err.message,
          );
        }
      }

      course.image = this.buildFileMetadata(result);
      await course.save();

      const courseWithImage = await this.attachImageUrl(course);

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Upload course image successfully',
        content: {
          course: courseWithImage,
        },
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `There is a problem while uploading course image: ${error.message}`,
        content: null,
      };
    }
  }

  async deleteCategory(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return {
          code: ERROR_RES.BAD_REQUEST_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'ID danh mục không hợp lệ',
          content: null,
        };
      }

      // Soft delete category by setting isActive = false
      const category = await this.courseCategoryModel.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true },
      );

      if (!category) {
        return {
          code: ERROR_RES.NOT_FOUND_ERROR.statusCode,
          info: ERROR_INFO.FAIL,
          message: 'Không tìm thấy danh mục khóa học',
          content: null,
        };
      }

      return {
        code: ERROR_RES.SUCCESS.statusCode,
        info: ERROR_INFO.SUCCESS,
        message: 'Xóa danh mục khóa học thành công',
        content: null,
      };
    } catch (error: any) {
      return {
        code: ERROR_RES.INTERNAL_ERROR.statusCode,
        info: ERROR_INFO.FAIL,
        message: `Lỗi khi xóa danh mục: ${error.message}`,
        content: null,
      };
    }
  }
}
