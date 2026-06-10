import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET') || 'htcaa';

    const rawEndpoint =
      this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';

    const normalizedEndpoint = rawEndpoint
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    const useSSL =
      this.configService.get<string>('MINIO_USE_SSL') === 'true' ||
      rawEndpoint.startsWith('https://');

    const portFromEnv = this.configService.get<string>('MINIO_PORT');

    const port = portFromEnv ? Number(portFromEnv) : useSSL ? 443 : 9000;

    this.publicUrl =
      this.configService.get<string>('MINIO_PUBLIC_URL') ||
      `${useSSL ? 'https' : 'http'}://${normalizedEndpoint}${
        port === 80 || port === 443 ? '' : `:${port}`
      }`;

    this.client = new Minio.Client({
      endPoint: normalizedEndpoint,
      port,
      useSSL,
      accessKey:
        this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey:
        this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin123',
      region: this.configService.get<string>('MINIO_REGION') || 'us-east-1',
    });
  }

  async onModuleInit() {
    const bucketExists = await this.client.bucketExists(this.bucket);

    if (!bucketExists) {
      await this.client.makeBucket(this.bucket);
    }

    await this.setPublicBucketPolicy();
  }

  private async setPublicBucketPolicy() {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: {
            AWS: ['*'],
          },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };

    await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{
    originalName: string;
    objectName: string;
    bucket: string;
    url: string;
    mimetype: string;
    size: number;
  }> {
    const safeOriginalName = file.originalname
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.-]/g, '');

    const objectName = `${folder}/${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}-${safeOriginalName}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    return {
      originalName: file.originalname,
      objectName,
      bucket: this.bucket,
      url: `${this.publicUrl}/${this.bucket}/${objectName}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async removeFile(objectName?: string | null) {
    if (!objectName) return;

    await this.client.removeObject(this.bucket, objectName);
  }
}
