(function(){
 const api=window.pixelApi,A=window.PixelAppearance;let state,seen=null,audio=null,generation=0;
 function stop(){generation++;if(audio){audio.pause();audio.currentTime=0;audio=null;}}
 function render(next){state=next;A.apply(next.prefs);document.getElementById('buddy').innerHTML=A.sprite(next.prefs,0,3);if(audio)audio.volume=next.prefs.volume/100;}
 async function show(event){
  if(!event){stop();return;}if(event.id===seen)return;seen=event.id;stop();const ticket=generation;
  const isBreak=event.kind==='break-done';document.getElementById('title').textContent=isBreak?'休息结束啦':'该休息啦';document.getElementById('text').textContent=isBreak?'准备好了，再开始下一小关。':'完成25分钟，起来活动一下吧。';document.getElementById('soundError').hidden=true;
  if(event.kind!=='focus-done')return;
  try{const url=await api.getSoundUrl();if(ticket!==generation)return;audio=new Audio(url);audio.volume=(state?state.prefs.volume:25)/100;await audio.play();}catch(_){document.getElementById('soundError').hidden=false;}
 }
 function ack(){stop();api.acknowledgeAlert();}
 document.getElementById('close').onclick=document.getElementById('acknowledge').onclick=ack;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')ack();});
 api.onStateChanged(render);api.onPomodoroAlert(show);api.getState().then(render);api.getAlert().then(show);
})();
