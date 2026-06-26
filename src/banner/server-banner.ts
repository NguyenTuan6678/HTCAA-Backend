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
${cyan}
 █   █  █████  █   █  █████  █   █   ██   ██
 ██ ██    █    █  █   █   █  ██  █  ████ ████
 █ █ █    █    ███    █████  █ █ █  █████████
 █   █    █    █  █   █   █  █  ██   ███████
 █   █  █████  █   █  █   █  █   █    █████
                                        ███
${reset}
`;

  const lines = [
    { label: '🚀 Server', value: `http://localhost:${port}`, color: green },
    { label: '📚 Swagger', value: `http://localhost:${port}/api/docs`, color: green },
    { label: '🌱 Env', value: env, color: yellow },
    { label: '📦 Node', value: nodeVersion, color: cyan },
    { label: '💻 OS', value: osType, color: cyan },
  ];

  const getVisibleLength = (str: string) => {
    return str.replace(/\x1b\[[0-9;]*m/g, '').length;
  };

  const footer1 = `✦ Made with care by Mikan ✦`;
  const footer2 = `✦ "I love cute stuff and dream of flying freely in the sky" ✦`;
  const header = `SYSTEM STATUS`;

  const visibleLengths = [
    getVisibleLength(header),
    getVisibleLength(footer1),
    getVisibleLength(footer2),
    ...lines.map((line) => getVisibleLength(line.label) + getVisibleLength(line.value)),
  ];

  const maxContentLength = Math.max(...visibleLengths);
  const boxWidth = maxContentLength + 8; // Left margin (4) + right margin (4)

  const drawLine = (left: string, right: string) => {
    const leftLen = getVisibleLength(left);
    const rightLen = getVisibleLength(right);
    const padding = ' '.repeat(Math.max(0, boxWidth - leftLen - rightLen - 6));
    return ` │  ${left}${padding}${right}  │`;
  };

  const drawCenteredLine = (text: string) => {
    const visibleLen = getVisibleLength(text);
    const totalPadding = Math.max(0, boxWidth - visibleLen - 6);
    const leftPad = Math.floor(totalPadding / 2);
    const rightPad = totalPadding - leftPad;
    return ` │  ${' '.repeat(leftPad)}${text}${' '.repeat(rightPad)}  │`;
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
  output += drawCenteredLine(`${bold}${magenta}${footer1}${reset}`) + '\n';
  output += drawCenteredLine(`${magenta}${footer2}${reset}`) + '\n';
  output += borderBottom;

  console.log(output);
}
