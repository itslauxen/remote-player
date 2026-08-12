Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
pasta = fso.GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = pasta
shell.Run """" & shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cloudflared\cloudflared.exe"" tunnel run remoteplayer", 0, False
shell.Run "cmd /c npm start", 0, False
