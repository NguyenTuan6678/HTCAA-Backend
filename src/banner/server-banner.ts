export function printServerBanner(port: number | string) {
  const env = process.env.NODE_ENV || 'development';
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const redisPort = process.env.REDIS_PORT || '6379';

  const banner = `
╭────────────────────────────────────────────────────────────╮
│                                                            │
│        ☁️   ✦  M-INVOICE BACKEND IS FLYING  ✦   ☁️           │
│                                                            │
│              ₊˚⊹  Made with care by Mikan  ⊹˚₊             │
│                                                            │
│        "I love cute stuff and dream of flying              │
│         freely in the sky."                                │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  🚀 Server   : http://localhost:${port}                     
│  📚 Swagger  : http://localhost:${port}/api/docs                 
│  🌱 Env      : ${env}                                       
│  🧵 Queue    :                         
│  🍓 Redis    : ${redisHost}:${redisPort}                    
│  📊 Report   :              
│                                                            │
╰────────────────────────────────────────────────────────────╯
`;

  console.log(banner);
}
