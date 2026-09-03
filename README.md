# Gestor de Chapa — Padaria Araújo

Aplicativo Electron para registrar, imprimir e acompanhar os pedidos da chapa.

## Dois computadores na mesma rede

1. No computador que ficará sempre ligado, abra `Ajustes` (F2), selecione `PC principal` e grave.
2. Anote o IP exibido pelo aplicativo e permita o Gestor de Chapa no Firewall do Windows para redes privadas.
3. No outro computador, selecione `PC secundário`, informe o IP do principal e mantenha a porta `37842`.
4. Grave as configurações. O aplicativo testa a conexão e os pedidos/status são sincronizados automaticamente a cada três segundos.
5. Antes de adicionar um item a uma comanda, o app busca a lista compartilhada mais recente para reduzir conflitos entre os dois PCs.

Somente um computador deve operar como principal. Ele precisa permanecer ligado e com o aplicativo aberto para que o secundário consiga sincronizar.

## Impressora térmica em rede

A impressora da chapa está configurada no endereço `192.168.15.217`, usando porta RAW `9100`.

- `USB deste PC`: usa a fila instalada no Windows deste computador.
- `Rede / IP`: envia ESC/POS diretamente para `192.168.15.217:9100`.
- No segundo PC, use também `Rede / IP`. Ele não depende da fila USB do computador principal para imprimir.
- O botão `Emitir Teste` primeiro verifica se a impressora responde no IP/porta configurados e depois envia uma impressão de teste.

Se o IP da impressora mudar no futuro, basta alterar o endereço em `Ajustes` nos computadores que imprimem por rede.
