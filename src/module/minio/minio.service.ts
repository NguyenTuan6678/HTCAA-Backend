import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';

export type UploadedMinioFile = {
  originalName: string;
  objectName: string;
  bucket: string;
  mimetype: string;
  size: number;
  url?: string; // ← add this
};

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;

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

    /**
     * Không set public policy nữa.
     * Bucket nên để private.
     * Khi FE cần xem ảnh/file, backend sẽ generate presigned URL.
     */
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadedMinioFile> {
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
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async getPresignedUrl(
    objectName?: string | null,
    expirySeconds?: number,
  ): Promise<string | null> {
    if (!objectName) return null;

    const expiresInEnv = this.configService.get<string>(
      'MINIO_PRESIGNED_EXPIRES_IN',
    );

    const parsedExpiresIn = expiresInEnv ? Number(expiresInEnv) : 3600;

    const expiresIn =
      expirySeconds ??
      (Number.isFinite(parsedExpiresIn) && parsedExpiresIn > 0
        ? parsedExpiresIn
        : 3600);

    return this.client.presignedGetObject(this.bucket, objectName, expiresIn);
  }

  async attachPresignedUrl<T extends Record<string, any> | null | undefined>(
    file: T,
    expirySeconds?: number,
  ): Promise<T> {
    if (!file?.objectName) return file as T;

    const url = await this.getPresignedUrl(file.objectName, expirySeconds);

    return {
      ...file,
      url,
    } as T;
  }

  async removeFile(objectName?: string | null) {
    if (!objectName) return;

    await this.client.removeObject(this.bucket, objectName);
  }

  async getFileStream(objectName: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectName);
  }
}
