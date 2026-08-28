
import { Order, PrinterConfig } from '../types';

class PrinterService {
  /**
   * Layout de impressão para Elgin i8 (80mm)
   */
  static printOrder(order: Order, config: PrinterConfig, isMerge: boolean = false) {
    console.log(`Printing to local Windows queue ${config.name}...`);
    const printedAt = new Date();
    const formattedDateTime = printedAt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const printContent = `
      <div class="thermal-print">
        <center>
          <div style="background: white; color: black; border: 4px solid black; padding: 3px; margin-bottom: 5px;">
            <div style="font-size: 16pt; font-weight: 900; line-height: 1;">COMANDA</div>
            <div style="font-size: 40pt; font-weight: 900; line-height: 1;">${order.comanda}</div>
            ${isMerge ? '<h2 style="font-size: 10pt; margin: 3px 0 0; border-top: 2px solid black;">ADICIONAL / ALTERAÇÃO</h2>' : ''}
          </div>
          <p style="margin: 8px 0 12px; font-size: 15pt; font-weight: 900;">${formattedDateTime}</p>
        </center>
        
        <hr style="border: 2px dashed black; margin: 10px 0;">
        
        ${order.entries.map((entry, eIdx) => `
          <div style="margin-bottom: 6px; border: ${entry.quantity > 1 ? '3px solid black' : 'none'}; padding: ${entry.quantity > 1 ? '5px' : '0'};">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 style="font-size: 22pt; margin: 0; text-transform: uppercase;">${entry.item.name}</h2>
              <div style="font-size: 28pt; font-weight: 900; background: ${entry.quantity > 1 ? 'black' : 'transparent'}; color: ${entry.quantity > 1 ? 'white' : 'black'}; padding: 2px 10px;">${entry.quantity}x</div>
            </div>

            ${entry.configs.map((cfg, idx) => `
              <div style="margin-top: 10px; padding-left: 10px; border-top: 1px dotted #888;">
                ${entry.quantity > 1 ? `<p style="font-size: 12pt; margin: 2px 0; font-weight: bold;">[ITEM ${idx + 1}]</p>` : ''}
                
                ${cfg.cheese ? `<p style="font-size: 14pt; margin: 2px 0;">QUEIJO: <strong>${cfg.cheese.toUpperCase()}</strong></p>` : ''}
                
                ${cfg.selectedAddOns.length > 0 ? `
                  <p style="font-size: 12pt; margin: 5px 0;"><strong>ADICIONAIS:</strong></p>
                  <div style="padding-left: 15px; font-size: 12pt;">
                    ${cfg.selectedAddOns.map(a => `• ${a.name.toUpperCase()}`).join('<br>')}
                  </div>
                ` : ''}
                
                ${cfg.observation ? `
                  <div style="margin-top: 5px; padding: 3px; border: 1px solid black;">
                    <p style="font-size: 14pt; margin: 0;"><strong>OBS:</strong> ${cfg.observation.toUpperCase()}</p>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          <hr style="border: 1px solid black; margin: 10px 0;">
        `).join('')}
        
        <div style="margin-top: 45px; min-height: 35mm;">
          <center>
            <p style="font-size: 10pt; font-weight: bold;">PADARIA ARAÚJO - SETOR CHAPA</p>
          </center>
        </div>
      </div>
    `;

    const rawData = this.buildEscPosReceipt(order, isMerge, formattedDateTime);
    this.executeBrowserPrint(printContent, rawData, config);
  }

  static testPrint(config: PrinterConfig) {
     const printContent = `
      <div class="thermal-print">
        <center>
          <h1 style="font-size: 20pt;">TESTE DE CONEXÃO</h1>
          <p>EQUIPAMENTO: ${config.name}</p>
          <p>CONEXÃO: USB LOCAL</p>
          <hr style="border: 1px dashed black;">
          <p style="font-size: 16pt;">PRONTO PARA USO</p>
        </center>
      </div>
    `;
    const rawData = this.buildEscPosTest(config);
    this.executeBrowserPrint(printContent, rawData, config);
  }

  private static ascii(text: string) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E\n]/g, '');
  }

  private static escPosBase64(chunks: Array<number[] | string>) {
    const bytes: number[] = [];
    chunks.forEach(chunk => {
      if (typeof chunk === 'string') {
        const value = this.ascii(chunk);
        for (let i = 0; i < value.length; i += 1) bytes.push(value.charCodeAt(i));
      } else {
        bytes.push(...chunk);
      }
    });

    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  private static buildEscPosReceipt(order: Order, isMerge: boolean, formattedDateTime: string) {
    const ESC = 0x1b;
    const GS = 0x1d;
    let bodyLines = 0;
    const chunks: Array<number[] | string> = [
      [ESC, 0x40],
      [ESC, 0x33, 0x24],
      [ESC, 0x61, 0x01],
      [ESC, 0x45, 0x01],
      [GS, 0x21, 0x11],
      'COMANDA\n',
      [GS, 0x21, 0x22],
      `${order.comanda}\n`,
      [GS, 0x21, 0x00],
      [ESC, 0x45, 0x00],
      isMerge ? 'ADICIONAL / ALTERACAO\n' : '',
      [ESC, 0x45, 0x01],
      [GS, 0x21, 0x01],
      `${formattedDateTime}\n`,
      [GS, 0x21, 0x00],
      [ESC, 0x45, 0x00],
      '\n',
      '------------------------------------------\n',
      [ESC, 0x61, 0x00]
    ];

    order.entries.forEach(entry => {
      chunks.push([ESC, 0x45, 0x01], [GS, 0x21, 0x11]);
      chunks.push(`${entry.quantity}X ${entry.item.name.toUpperCase()}\n`);
      chunks.push([GS, 0x21, 0x00], [ESC, 0x45, 0x00]);
      chunks.push('\n');
      bodyLines += 3;

      entry.configs.forEach((cfg, index) => {
        if (entry.quantity > 1) {
          chunks.push(`[ITEM ${index + 1}]\n`);
          bodyLines += 1;
        }
        if (cfg.cheese) {
          chunks.push(`QUEIJO: ${cfg.cheese.toUpperCase()}\n`);
          bodyLines += 1;
        }
        if (cfg.selectedAddOns.length) {
          chunks.push([ESC, 0x45, 0x01], 'ADICIONAIS:\n', [ESC, 0x45, 0x00]);
          cfg.selectedAddOns.forEach(addOn => chunks.push(`- ${addOn.name.toUpperCase()}\n`));
          bodyLines += 1 + cfg.selectedAddOns.length;
        }
        if (cfg.observation) {
          chunks.push('\n', [ESC, 0x45, 0x01], `OBS: ${cfg.observation.toUpperCase()}\n`, [ESC, 0x45, 0x00]);
          bodyLines += 2;
        }
      });
      chunks.push('\n', '------------------------------------------\n');
      bodyLines += 2;
    });

    const minimumBodyLines = 12;
    const footerSpacing = Math.max(4, minimumBodyLines - bodyLines);
    chunks.push(
      [ESC, 0x64, footerSpacing],
      [ESC, 0x61, 0x01],
      [ESC, 0x45, 0x01],
      'PADARIA ARAUJO - SETOR CHAPA\n',
      [ESC, 0x45, 0x00],
      [ESC, 0x32],
      [ESC, 0x64, 0x04],
      [GS, 0x56, 0x00]
    );
    return this.escPosBase64(chunks);
  }

  private static buildEscPosTest(config: PrinterConfig) {
    const ESC = 0x1b;
    const GS = 0x1d;
    return this.escPosBase64([
      [ESC, 0x40], [ESC, 0x61, 0x01], [ESC, 0x45, 0x01], [GS, 0x21, 0x11],
      'TESTE DE CONEXAO\n',
      [GS, 0x21, 0x00], [ESC, 0x45, 0x00],
      `EQUIPAMENTO: ${config.name}\n`,
      'IMPRESSAO RAW/ESC-POS\n',
      'PRONTO PARA USO\n',
      [ESC, 0x64, 0x04], [GS, 0x56, 0x00]
    ]);
  }

  private static async executeBrowserPrint(html: string, rawData: string, config: PrinterConfig) {
    try {
      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt({ printerName: config.name, rawData });
      } else {
        const printElement = document.createElement('div');
        printElement.className = 'print-only';
        printElement.innerHTML = html;
        document.body.appendChild(printElement);
        window.print();
        printElement.remove();
      }
    } catch (error) {
      console.error('Falha na impressão direta:', error);
      alert(error instanceof Error ? error.message : 'Não foi possível imprimir o pedido.');
    }
  }
}

export default PrinterService;
