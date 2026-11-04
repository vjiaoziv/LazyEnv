Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
  Select-Object -First 4 -ExpandProperty CommandLine |
  ForEach-Object { if ($_.Length -gt 700) { $_.Substring(0,700) } else { $_ } }