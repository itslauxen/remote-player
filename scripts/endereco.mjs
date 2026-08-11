import { networkInterfaces } from 'node:os';

const porta = process.env.PORT || 8765;
const enderecos = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i.address}:${porta}`);

console.log(
  enderecos.length
    ? `\n  Abra no celular (mesma rede Wi-Fi):\n\n${enderecos.map((e) => `    ${e}`).join('\n')}\n`
    : '\n  Nenhuma interface de rede encontrada. O PC esta conectado no Wi-Fi?\n',
);
