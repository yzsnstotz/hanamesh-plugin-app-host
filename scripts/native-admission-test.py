"""Additional D214 review regressions; own tiny Git fixture, never Desktop source."""
import argparse,importlib.util,json,os,pathlib,shutil,subprocess,sys,tempfile,unittest

class Admission(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=OPTIONS.scratch);self.addCleanup(self.tmp.cleanup)
  self.root=pathlib.Path(self.tmp.name);helpers=self.root/'helpers';helpers.mkdir()
  for name in ['lifecycle.py','exit_observer.py']:shutil.copyfile(OPTIONS.source/name,helpers/name)
  sys.path.insert(0,str(helpers));self.addCleanup(lambda:sys.path.remove(str(helpers)))
  spec=importlib.util.spec_from_file_location('admission_fixture_driver',helpers/'lifecycle.py');self.driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.driver)
  upstream=self.root/'upstream';upstream.mkdir();self.upstream=upstream
  self.c=self.driver.configuration(self.root,[54241,54242,54243]);self.c.update(dependencies=[],ports=[],cwd=str(upstream),verifyCommit=False)

 def test_staged_own_fixture_source_cannot_pass_fixed_source_gate(self):
  def git(*args):return subprocess.check_output(['git','-C',str(self.upstream),*args],stderr=subprocess.DEVNULL,text=True).strip()
  git('init');file=self.upstream/'owned-fixture.txt';file.write_text('original own test data\n');git('add','owned-fixture.txt')
  git('-c','user.name=fixture','-c','user.email=fixture@localhost','-c','commit.gpgsign=false','commit','-m','own fixture')
  # Substitute only this isolated test repo's expected identity, not the real
  # fixed Desktop checkout or the canonical driver constant.
  self.driver.FIXED=git('rev-parse','HEAD');self.c['verifyCommit']=True
  self.assertTrue(self.driver.preflight(self.c));file.write_text('staged changed own test data\n');git('add','owned-fixture.txt')
  self.assertEqual(git('diff','--name-only'),'','fixture must represent the staged-only gap')
  with self.assertRaisesRegex(self.driver.GateError,'UPSTREAM_SOURCE_CHANGED'):
   self.driver.preflight(self.c)

 def test_second_admission_is_blocked_before_first_spawn_and_reservation_survives_interruption(self):
  class BeforeSpawnStop(Exception):pass
  original=self.driver.subprocess.Popen
  def intercepted_spawn(*args,**kwargs):
   if not args or args[0]!=self.c['command']:return original(*args,**kwargs)
   # No child is ever created. Interrupt at the exact spawn boundary after
   # asking the actual public admission gate whether a second start is allowed.
   self.driver.subprocess.Popen=original
   with self.assertRaisesRegex(self.driver.GateError,'NATIVE_LAUNCH_RESERVED',msg='second native admission was allowed before first spawn'):
    self.driver.preflight(self.c)
   raise BeforeSpawnStop()
  self.driver.subprocess.Popen=intercepted_spawn
  try:
   with self.assertRaises(BeforeSpawnStop):self.driver.run(self.c)
  finally:self.driver.subprocess.Popen=original
  with self.assertRaisesRegex(self.driver.GateError,'NATIVE_LAUNCH_RESERVED'):
   self.driver.preflight(self.c)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--scratch',type=pathlib.Path,required=True);OPTIONS=p.parse_args();sys.dont_write_bytecode=True;unittest.main(argv=[sys.argv[0]],verbosity=2)
