import { registerAs } from '@nestjs/config';

interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodb: {
    uri: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  logging: {
    level: string;
  };
  mInvoiceToken: {
    mToken: string;
  };
}

export default registerAs<AppConfig>('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    name: process.env.MONGODB_NAME || 'NAMELESS',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '22v1jv2hv1h3v1uk3h1v23j1v1v3h1v2',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  mInvoiceToken: {
    mToken: process.env.MINVOICE_RECEIPT_TOKEN || 'ywuigeiuaehgawgeage',
  },
}));
