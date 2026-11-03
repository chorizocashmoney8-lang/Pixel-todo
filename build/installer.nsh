# The custom page is compiled only into the installer. The installer option
# also controls whether uninstall removes the desktop shortcut it created.
!ifdef BUILD_UNINSTALLER
!include "LogicLib.nsh"

!macro customUnInstall
  ${IfNot} ${isKeepShortcuts}
    ReadRegStr $R0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut
    ${If} $R0 == ""
    ${OrIf} $R0 == "true"
      # Empty means a legacy install that used the built-in shortcut behavior.
      WinShell::UninstShortcut "$oldDesktopLink"
      Delete "$oldDesktopLink"
    ${EndIf}
  ${EndIf}
!macroend
!else
!include "MUI2.nsh"
!include "nsDialogs.nsh"

Var PixelTodoDesktopShortcut
Var PixelTodoDesktopShortcutCheckbox
Var PixelTodoDesktopShortcutDialog

!macro customInit
  StrCpy $PixelTodoDesktopShortcut ${BST_CHECKED}
!macroend

!macro customPageAfterChangeDir
  Page custom PixelTodoDesktopShortcutPageCreate PixelTodoDesktopShortcutPageLeave
!macroend

Function PixelTodoDesktopShortcutPageCreate
  ${If} ${Silent}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "桌面快捷方式" "请选择是否创建桌面快捷方式。"
  nsDialogs::Create 1018
  Pop $PixelTodoDesktopShortcutDialog
  ${If} $PixelTodoDesktopShortcutDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "请选择安装选项，然后点击“安装”继续。"
  Pop $0
  ${NSD_CreateCheckbox} 0 34u 100% 12u "创建桌面快捷方式"
  Pop $PixelTodoDesktopShortcutCheckbox
  # Restore the saved choice on reentry instead of checking it again.
  ${NSD_SetState} $PixelTodoDesktopShortcutCheckbox $PixelTodoDesktopShortcut
  ${NSD_OnBack} PixelTodoDesktopShortcutPageLeave
  nsDialogs::Show
FunctionEnd

Function PixelTodoDesktopShortcutPageLeave
  ${NSD_GetState} $PixelTodoDesktopShortcutCheckbox $PixelTodoDesktopShortcut
FunctionEnd

!macro customInstall
  ${If} ${isUpdated}
    # Preserve electron-builder update behavior, including keepShortcuts and rename handling.
    !undef DO_NOT_CREATE_DESKTOP_SHORTCUT
    !insertmacro addDesktopLink $keepShortcuts
    !define DO_NOT_CREATE_DESKTOP_SHORTCUT
  ${ElseIf} ${Silent}
    # Preserve the default silent-install shortcut behavior and honor its opt-out flag.
    !undef DO_NOT_CREATE_DESKTOP_SHORTCUT
    !insertmacro addDesktopLink $keepShortcuts
    !define DO_NOT_CREATE_DESKTOP_SHORTCUT
    ${If} ${isNoDesktopShortcut}
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "false"
    ${EndIf}
  ${ElseIf} $PixelTodoDesktopShortcut != ${BST_CHECKED}
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "false"
  ${ElseIf} ${isNoDesktopShortcut}
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "false"
  ${ElseIf} ${FileExists} "$newDesktopLink"
    # Do not overwrite an existing user-created link or claim it for uninstall.
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "false"
  ${Else}
    ClearErrors
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ${IfNot} ${Errors}
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "true"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    ${Else}
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" PixelTodoDesktopShortcut "false"
      ClearErrors
    ${EndIf}
  ${EndIf}
!macroend
!endif
