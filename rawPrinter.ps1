param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$DataFile
)

$source = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOC_INFO_1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOC_INFO_1 di);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr hPrinter, byte[] bytes, int count, out int written);

  public static int Send(string printerName, byte[] bytes) {
    IntPtr printer;
    if (!OpenPrinter(printerName, out printer, IntPtr.Zero))
      throw new Win32Exception(Marshal.GetLastWin32Error(), "Nao foi possivel abrir a impressora.");
    try {
      var info = new DOC_INFO_1 { pDocName = "Gestor de Chapa", pDataType = "RAW" };
      if (StartDocPrinter(printer, 1, info) == 0)
        throw new Win32Exception(Marshal.GetLastWin32Error(), "Nao foi possivel iniciar o documento RAW.");
      try {
        if (!StartPagePrinter(printer))
          throw new Win32Exception(Marshal.GetLastWin32Error(), "Nao foi possivel iniciar a pagina RAW.");
        try {
          int written;
          if (!WritePrinter(printer, bytes, bytes.Length, out written))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "WritePrinter falhou.");
          if (written != bytes.Length)
            throw new Exception("O spooler recebeu apenas " + written + " de " + bytes.Length + " bytes.");
          return written;
        } finally { EndPagePrinter(printer); }
      } finally { EndDocPrinter(printer); }
    } finally { ClosePrinter(printer); }
  }
}
'@

Add-Type -TypeDefinition $source -Language CSharp
$bytes = [System.IO.File]::ReadAllBytes($DataFile)
$written = [RawPrinter]::Send($PrinterName, $bytes)
Write-Output "OK: $written bytes enviados em RAW para $PrinterName"
