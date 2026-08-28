
import { Order, PrinterConfig } from '../types';

class PrinterService {
  /**
   * Layout de impressão para Elgin i8 (80mm)
   */
  static printOrder(order: Order, config: PrinterConfig, isMerge: boolean = false) {
    console.log(`Printing to ${config.name} at ${config.ip}...`);
    
    const printContent = `
      <div class="thermal-print">
        <center>
          <div style="background: white; color: black; border: 4px solid black; padding: 3px; margin-bottom: 5px;">
            <div style="font-size: 16pt; font-weight: 900; line-height: 1;">COMANDA</div>
            <div style="font-size: 40pt; font-weight: 900; line-height: 1;">${order.comanda}</div>
            ${isMerge ? '<h2 style="font-size: 10pt; margin: 3px 0 0; border-top: 2px solid black;">ADICIONAL / ALTERAÇÃO</h2>' : ''}
          </div>
          <p style="margin: 5px 0; font-size: 14pt;">DATA: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
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
        
        <div style="margin-top: 30px;">
          <center>
            <p style="font-size: 10pt; font-weight: bold;">PADARIA ARAÚJO - SETOR CHAPA</p>
            <p style="font-size: 8pt;">${new Date().toLocaleString()}</p>
          </center>
        </div>
      </div>
    `;

    this.executeBrowserPrint(printContent, config);
  }

  static testPrint(config: PrinterConfig) {
     const printContent = `
      <div class="thermal-print">
        <center>
          <h1 style="font-size: 20pt;">TESTE DE CONEXÃO</h1>
          <p>EQUIPAMENTO: ${config.name}</p>
          <p>IP: ${config.ip}</p>
          <hr style="border: 1px dashed black;">
          <p style="font-size: 16pt;">PRONTO PARA USO</p>
        </center>
      </div>
    `;
    this.executeBrowserPrint(printContent, config);
  }

  private static async executeBrowserPrint(html: string, config: PrinterConfig) {
    const printElement = document.createElement('div');
    printElement.className = 'print-only';
    printElement.innerHTML = html;
    document.body.appendChild(printElement);

    try {
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      if (window.electronAPI?.printReceipt) {
        await window.electronAPI.printReceipt(config.name);
      } else {
        window.print();
      }
    } catch (error) {
      console.error('Falha na impressão direta:', error);
      alert(error instanceof Error ? error.message : 'Não foi possível imprimir o pedido.');
    } finally {
      printElement.remove();
    }
  }
}

export default PrinterService;
