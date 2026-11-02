const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const {createStore} = require('./store');
const {createTimer} = require('./timer');
const {createHandlers,register} = require('./ipc');
const {createWidget,createAppWindow,createReminderWindow,resizeWidget} = require('./windows');
const {createWindowController} = require('./window-controller');
const {createTray} = require('./tray');
const {createAudioLibrary} = require('./audio');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
if (process.env.PIXEL_TODO_TEST_DATA) {
 require('node:fs').mkdirSync(process.env.PIXEL_TODO_TEST_DATA,{recursive:true});
 app.setPath('userData',process.env.PIXEL_TODO_TEST_DATA);
}
const state={quitting:false,controller:null};
let widget,appWindow,reminder,trayCtl,ticker,activeAlert=null,serial=0;
function acknowledge(){ activeAlert=null;if(reminder&&!reminder.isDestroyed()){reminder.webContents.send('pomodoro:alert',null);reminder.hide();}if(trayCtl)trayCtl.clearAlert(); }
function openApp(){if(state.controller)state.controller.openApp();}
function start(){
 app.on('second-instance',openApp);
 app.whenReady().then(()=>{
  const userDir=process.env.PIXEL_TODO_TEST_DATA||app.getPath('userData');
  const store=createStore(userDir);
  let lastAutoStart;
  function syncSystem(prefs){
   if(widget&&!widget.isDestroyed())resizeWidget(widget,prefs);
   if(app.isPackaged&&!process.env.PIXEL_TODO_TEST_DATA&&prefs.autoStart!==lastAutoStart){app.setLoginItemSettings({openAtLogin:prefs.autoStart});lastAutoStart=prefs.autoStart;}
  }
  const notify=()=>{const snapshot=store.get();syncSystem(snapshot.prefs);BrowserWindow.getAllWindows().forEach(w=>{if(!w.isDestroyed())w.webContents.send('state:changed',snapshot);});};
  function onAlert(kind){
   activeAlert={id:++serial,kind};
   state.controller.revealForAlert();
   try {
    const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    reminder.setPosition(area.x+area.width-356,area.y+area.height-212);
   } catch (e) { console.error('提醒定位失败,使用窗口当前位置:',e.message); }
   reminder.showInactive(); reminder.moveTop();
   reminder.webContents.send('pomodoro:alert',activeAlert);
   trayCtl.setAlert(kind==='focus-done'?'学习结束,该休息了':'休息结束');
  }
  const timer=createTimer(store,Date.now,notify,onAlert);timer.init();
  widget=createWidget(store);appWindow=createAppWindow(state);reminder=createReminderWindow(state,acknowledge);
  state.controller=createWindowController(appWindow,widget);
  widget.once('ready-to-show',()=>{if(!appWindow.isVisible())widget.showInactive();});
  trayCtl=createTray(openApp,()=>{state.quitting=true;app.quit();});
  const library=createAudioLibrary(userDir,path.join(__dirname,'../assets/audio'),store);
  register(ipcMain,createHandlers(store,timer,Date.now,notify));
  for(const[name,fn]of Object.entries({openApp,minimizeApp:()=>state.controller.minimizeApp(),hideApp:()=>state.controller.hideApp(),hideWidget:()=>state.controller.hideWidget()}))ipcMain.handle('window:'+name,fn);
  ipcMain.handle('alert:get',()=>activeAlert);
  ipcMain.handle('alert:acknowledge',acknowledge);
  ipcMain.handle('sound:url',()=>library.url());
  ipcMain.handle('sound:import',async()=>{
   const selection=await dialog.showOpenDialog(appWindow,{title:'选择提示音（不超过10 MB）',properties:['openFile'],filters:[{name:'音频',extensions:['wav','mp3','ogg','m4a']}]});
   if(selection.canceled)return{canceled:true};
   const name=await library.importFile(selection.filePaths[0]);notify();return{name};
  });
  syncSystem(store.get().prefs);
  ticker=setInterval(()=>timer.tick(),1000);
 }).catch(error=>{dialog.showErrorBox('Pixel Todo 无法启动','读写软件数据失败：\n'+error.message);app.exit(1);});
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{state.quitting=true;clearInterval(ticker);if(trayCtl)trayCtl.clearAlert();});
}
if(!app.requestSingleInstanceLock())app.quit();else start();
