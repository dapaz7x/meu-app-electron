# Gestor de Chapa — Padaria Araújo

Aplicativo Electron para comandas e impressão RAW/ESC-POS, por USB ou diretamente na impressora `192.168.50.217:9100`.

## Lançar várias unidades

Informe a comanda e ajuste a quantidade **logo abaixo de cada produto**, pelos botões −/+ ou digitando (até 99). Tocar no nome acrescenta uma unidade. Selecione vários produtos na mesma tela, confira o resumo e clique em **Enviar N itens para a chapa**. Sem adicionais, não há outra tela para percorrer.

- **Busca:** aceita nomes com ou sem acentos. **Selecionados** mostra somente o que está no lançamento; o × no resumo remove um produto antes do envio.
- **Adicionais / queijo:** opcionais, aplicados a todas as unidades por padrão. **Adicionais diferentes** permite ajustar apenas as unidades que precisam de uma exceção.
- **Pastel Frito:** distribua a quantidade entre os sabores com −/+; **Todos** aplica o mesmo sabor a todos. O envio exige que toda a quantidade tenha sabor.
- **Observação da comanda:** um único campo para todos os produtos, exibido uma vez no painel e no cupom. Em um acréscimo, a observação existente vem preenchida e pode ser atualizada ou apagada. Indique o produto no texto quando houver uma exceção (por exemplo, "1 Kids sem cebola"). Não há campo de observação por unidade nos pedidos novos; observações individuais de pedidos antigos continuam preservadas.
- O formato dos itens permanece `quantity` + uma configuração por unidade. Uma confirmação salva todos os produtos e gera um cupom só com os novos itens. Detalhes iguais são agrupados no painel e no cupom.
- Sair de um lançamento com itens pendentes pede confirmação. Escape dentro dos detalhes fecha somente os detalhes. Durante o envio, a navegação fica bloqueada; se o salvamento falhar, o formulário conserva os itens e a observação para nova tentativa.
- A observação geral fica em `Order.observation`; cada lançamento guarda `orderObservation` para preservar a informação original no histórico semanal mesmo se a observação mudar depois.
- Produtos, adicionais e sabores aparecem em ordem alfabética na seleção. Os dados originais e IDs não são reordenados nem modificados.

## Relatórios e cancelamentos

Abra **Dados** ou pressione **F1**. O painel mostra a semana completa (segunda a domingo, fuso de São Paulo), com opção de ver somente **Hoje** ou escolher semanas anteriores.

São exibidos unidades válidas, unidades canceladas, produtos vendidos, quantidades por produto, ranking, comandas válidas e finalizadas. O tempo médio até finalizar mantém a métrica existente de criação até finalização. Neste momento o relatório trabalha somente com **quantidades**, sem preços ou faturamento em reais.

Em **Histórico de lançamentos**, use a pesquisa e o filtro Válidos/Cancelados. **Cancelar lançamento** abre uma confirmação e um motivo opcional. O cancelamento abrange todas as unidades daquele lançamento, exclui-as das estatísticas e conserva o registro original, a data e o motivo. É um cancelamento do relatório: não altera a fila da cozinha, a comanda nem imprime outro cupom. Um cancelamento confirmado não tem ação de desfazer nesta versão.

### Arquivos TXT

Os pedidos continuam em `pedidos.json`, no diretório de dados do aplicativo. Os relatórios aproveitam esses pedidos existentes, incluindo o histórico anterior à atualização.

O diretório `relatorios` fica dentro de `app.getPath('userData')`, fora da pasta de instalação. O botão **Pasta dos TXT** abre o local correto. Exemplo de arquivo:

```text
relatorios/2026-09-28_a_2026-10-04.txt
```

Cada TXT é um histórico UTF-8 de eventos em JSON, um por linha, com comentários de cabeçalho iniciados por `#`. Os eventos são `LANÇAMENTO`, `ANDAMENTO` e `CANCELAMENTO`; apenas novas linhas são acrescentadas. Os lançamentos incluem produto, quantidade, comanda, detalhes individuais e datas. O painel calcula os totais a partir desses registros. Não edite os arquivos manualmente; copie a pasta inteira para fazer backup.

O par `orderId` + `entryId` impede duplicação na reimportação. Um cancelamento permanece válido mesmo após reiniciar ou receber novamente o pedido original. Acréscimos são classificados pelo horário do lançamento (`addedAt`), inclusive quando uma comanda atravessa semanas. Um arquivo inválido é preservado e o painel mostra o erro em vez de apresentar totais incompletos.

Em modo **principal/secundário**, os TXT e cancelamentos ficam no principal, e os dois computadores consultam o mesmo relatório pela conexão de pedidos existente na porta `37842`. No secundário, o botão de pasta informa que os arquivos estão no principal. Em modo **local**, ficam neste computador. Atualize os dois aplicativos para usar as novas rotas de relatórios; um principal antigo não as oferece.

## Atalhos

- F1: relatórios.
- Ctrl + Shift + F12: painel administrativo.
- Escape: voltar ao painel.
- F2: permanece sem ação administrativa.

## Verificação local

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:ui
```

Os testes de interface usam Chrome no Windows. Para usar o Chromium do Playwright, instale com `npx playwright install chromium` e defina `PLAYWRIGHT_CHANNEL=chromium`. Esses testes usam dados simulados e interceptam o IPC de impressão; não enviam cupons à impressora real. Os testes de persistência usam pastas temporárias, e o teste de comunicação principal/secundário usa transporte simulado.

O workflow `checks.yml` verifica TypeScript, testes, build e interface sem publicar. O workflow `release.yml` publica apenas quando uma tag `v*` é enviada, exige a mesma versão na tag, no `package.json` e no `package-lock.json`, e repete as validações antes de gerar o instalador. Commits comuns não publicam releases. Para validar localmente sem publicar, use `npx electron-builder --win --x64 --publish never`.

A versão 1.0.21 reúne o lançamento rápido de quantidades, a observação geral da comanda e os relatórios semanais com cancelamento auditável. Atualize os dois PCs para que principal e secundário tenham as mesmas funcionalidades.
