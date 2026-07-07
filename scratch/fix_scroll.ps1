$c = Get-Content 'c:\Survey-Dashboard\src\pages\Assigner.jsx';
$c[594] = '                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>';
$c | Set-Content 'c:\Survey-Dashboard\src\pages\Assigner.jsx' -Encoding UTF8;
