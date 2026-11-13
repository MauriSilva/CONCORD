using System;
using System.Runtime.InteropServices;

public class Program {
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    public static void Main(string[] args) {
        if (args.Length == 0) {
            Console.WriteLine("0");
            return;
        }

        string raw = args[0];
        if (raw.StartsWith("window:")) {
            string[] parts = raw.Split(':');
            if (parts.Length > 1) {
                raw = parts[1];
            }
        }

        long handleVal = 0;
        if (long.TryParse(raw, out handleVal)) {
            IntPtr hwnd = new IntPtr(handleVal);
            uint pid = 0;
            GetWindowThreadProcessId(hwnd, out pid);
            Console.WriteLine(pid);
        } else {
            Console.WriteLine("0");
        }
    }
}
