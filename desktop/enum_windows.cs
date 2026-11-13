using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

class Program
{

    [DllImport("user32.dll")]
static extern bool IsWindowVisible(IntPtr hWnd);

[DllImport("dwmapi.dll")]
static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

const int DWMWA_CLOAKED = 14;

static bool IsRealVisibleWindow(IntPtr hWnd)
{
    if (!IsWindowVisible(hWnd)) return false;
    int cloaked;
    DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(int));
    return cloaked == 0;
}

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint dwFlags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFOEX lpmi);

    const uint MONITOR_DEFAULTTONEAREST = 2;

    [StructLayout(LayoutKind.Sequential)]
    struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MONITORINFOEX
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string szDevice;
    }

    static bool IsFullscreen(IntPtr hWnd)
    {
        if (hWnd == IntPtr.Zero) return false;
        RECT wndRect;
        if (!GetWindowRect(hWnd, out wndRect)) return false;
        IntPtr hMonitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFOEX mi = new MONITORINFOEX();
        mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
        if (!GetMonitorInfoW(hMonitor, ref mi)) return false;
        RECT m = mi.rcMonitor;
        return wndRect.Left <= m.Left && wndRect.Top <= m.Top &&
               wndRect.Right >= m.Right && wndRect.Bottom >= m.Bottom;
    }

    static void Main()
    {
        List<string> entries = new List<string>();

        foreach (Process p in Process.GetProcesses())
        {
            try
            {
                if (p.MainWindowHandle == IntPtr.Zero) continue;
                string title = p.MainWindowTitle;
                if (string.IsNullOrEmpty(title)) continue;
                if (title == "Program Manager") continue;
                if (!IsRealVisibleWindow(p.MainWindowHandle)) continue;

                bool fs = IsFullscreen(p.MainWindowHandle);
                string esc = title.Replace("\\", "\\\\").Replace("\"", "\\\"")
                                  .Replace("\n", "\\n").Replace("\r", "\\r");

                entries.Add(string.Format(
                    "{{\"hwnd\":{0},\"pid\":{1},\"name\":\"{2}\",\"fullscreen\":{3}}}",
                    p.MainWindowHandle.ToInt64(), p.Id, esc, fs ? "true" : "false"));
            }
            catch { }
        }

        Console.Write("[");
        Console.Write(string.Join(",", entries.ToArray()));
        Console.Write("]");
    }
}
