export function printServerBanner(port: number | string) {
  const env = (process.env.NODE_ENV || 'development').toUpperCase();
  const nodeVersion = process.version;
  const osType = process.platform.toUpperCase();

  const cyan = '\x1b[36m';
  const magenta = '\x1b[35m';
  const green = '\x1b[32m';
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const gray = '\x1b[90m';

  const logo = `
${cyan}   __  __      ___                      _            
  |  \\\\/  | ___|_ _|_ ____   _____ (_) ___ ___ 
  | |\\\\/| |/ __| | | '_ \\\\ \\\\ / / _ \\\\| |/ __/ _ \\\\
  | |  | | (__  | | | | \\\\ V / (_) | | (_|  __/
  |_|  |_|\\\\___|___|_| |_|\\\\_/ \\\\___/|_|\\\\___\\\\___|${reset}
`;

  const lines = [
    { label: '🚀 Server', value: `http://localhost:${port}`, color: green },
    { label: '📚 Swagger', value: `http://localhost:${port}/api/docs`, color: green },
    { label: '🌱 Env', value: env, color: yellow },
    { label: '⚙️  Node', value: nodeVersion, color: cyan },
    { label: '💻 OS', value: osType, color: cyan },
  ];

  const boxWidth = 66;

  const drawLine = (left: string, right: string) => {
    const leftVisible = left.replace(/\x1b\[[0-9;]*m/g, '');
    const rightVisible = right.replace(/\x1b\[[0-9;]*m/g, '');
    const rawLength = leftVisible.length + rightVisible.length;
    const padding = ' '.repeat(Math.max(0, boxWidth - rawLength - 6));
    return ` │  ${left}${padding}${right}  │`;
  };

  const borderTop = ` ╭${'─'.repeat(boxWidth - 2)}╮`;
  const borderDivider = ` ├${'─'.repeat(boxWidth - 2)}┤`;
  const borderBottom = ` ╰${'─'.repeat(boxWidth - 2)}╯`;

  let output = logo + '\n';
  output += borderTop + '\n';
  output += drawLine(`${bold}${cyan}SYSTEM STATUS${reset}`, '') + '\n';

  lines.forEach((line) => {
    output +=
      drawLine(
        `${gray}${line.label}${reset}`,
        `${line.color}${line.value}${reset}`,
      ) + '\n';
  });

  output += borderDivider + '\n';
  output +=
    drawLine(`${bold}${magenta}✨ Made with care by Mikan ✨${reset}`, '') +
    '\n';
  output +=
    drawLine(
      `${magenta}☁️  "I love cute stuff and dream of flying freely in the sky" ☁️${reset}`,
      '',
    ) + '\n';
  output += borderBottom;

  console.log(output);
}
