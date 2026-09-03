# Gestor de Chapa — Padaria Araújo

Aplicativo Electron para registrar, imprimir e acompanhar os pedidos da chapa.

## Dois computadores na mesma rede

1. No computador que ficará sempre ligado, abra `Ajustes` (F2), selecione `PC principal` e grave.
2. Anote o IP exibido pelo aplicativo e permita o Gestor de Chapa no Firewall do Windows para redes privadas.
3. No outro computador, selecione `PC secundário`, informe o IP do principal e mantenha a porta `37842`.
4. Grave as configurações. Os pedidos e status são sincronizados a cada três segundos.

## Impressora térmica

- `USB deste PC`: informe exatamente o nome da fila instalada no Windows.
- `Rede / IP`: informe o IP fixo da impressora e a porta RAW, normalmente `9100`.

Somente um computador deve operar como principal. Ele precisa permanecer ligado e com o aplicativo aberto para que o secundário consiga sincronizar.
