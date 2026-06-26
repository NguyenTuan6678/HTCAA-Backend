import { registerAs } from '@nestjs/config';

interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodb: {
    uri: string;
    name: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  logging: {
    level: string;
  };
}

export default registerAs<AppConfig>('app', () => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET environment variable is required. Set it in your .env file.',
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      name: process.env.MONGODB_NAME || 'NAMELESS',
    },
    jwt: {
      secret: jwtSecret,
      expiresIn: process.env.JWT_EXPIRATION || '12h',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'debug',
    },
  };
});

