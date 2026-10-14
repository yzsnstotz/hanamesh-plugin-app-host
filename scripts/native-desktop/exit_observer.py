import select,os,time
# macOS SDK sys/event.h: NOTE_EXITSTATUS valid when caller may signal the target PID.
NOTE_EXITSTATUS=0x04000000
NOTE_EXIT_DETAIL=0x02000000
class ExitObserver:
 def __init__(self):self.queue=select.kqueue();self.identities={};self.attempted=set();self.registrationErrors=[]
 def register(self,pid,start):
  if pid in self.attempted:return
  self.attempted.add(pid)
  try:
   self.queue.control([select.kevent(pid,filter=select.KQ_FILTER_PROC,flags=select.KQ_EV_ADD|select.KQ_EV_ENABLE|select.KQ_EV_ONESHOT,fflags=select.KQ_NOTE_EXIT|NOTE_EXITSTATUS|NOTE_EXIT_DETAIL)],0,0)
   self.identities[pid]=start
  except OSError as e:self.registrationErrors.append({'pid':pid,'start':start,'error':str(e),'status':'UNKNOWN_PROCESS_ALREADY_EXITED_OR_UNOBSERVABLE'})
 def poll(self):
  rows=[]
  for e in self.queue.control(None,512,0):
   status=e.data
   rows.append({'pid':e.ident,'start':self.identities.get(e.ident),'timeNs':time.time_ns(),'rawStatus':status,'flags':e.fflags,'exitCode':os.WEXITSTATUS(status) if os.WIFEXITED(status) else None,'signal':os.WTERMSIG(status) if os.WIFSIGNALED(status) else None,'source':'Darwin EVFILT_PROC NOTE_EXITSTATUS'})
  return rows
 def close(self):self.queue.close()
