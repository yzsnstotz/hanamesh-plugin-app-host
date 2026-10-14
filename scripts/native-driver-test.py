"""Q-374 owned-native-driver contract tests. Never starts Electron.

Run explicitly with --driver, --upstream, --node and --scratch. The driver is
loaded from the supplied current card helper, not copied into a test fixture.
These tests supplement CI=true pnpm test; they do not replace native U2.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

FLAGS = ['--use-mock-keychain', '--password-store=basic']
FIXED = 'd743267388641bc76f17c45ce8b4c231aed1d32c'


class NativeDriver(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=OPTIONS.scratch)
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.c = DRIVER.configuration(self.root, [54241, 54242, 54243])

    def admitted_fixture(self):
        # No runtime is installed/launched. Isolate command admission from the
        # separately required fixed-upstream and dependency preparation gates.
        Path(self.c['cwd']).mkdir(parents=True)
        self.c.update(dependencies=[], ports=[], verifyCommit=False)
        launcher = self.root / 'generated' / 'Harness Dev.app/Contents/MacOS/HarnessDev'
        self.c['command'] = [str(launcher), *FLAGS]
        return self.c

    def test_current_configuration_supplies_both_flags_in_order(self):
        command = self.c['command']
        self.assertEqual(command[-2:], FLAGS,
                         'NATIVE_KEYCHAIN_ARGUMENTS_MISSING: actual configuration must pass both switches')
        self.assertEqual(Path(command[0]).name, 'HarnessDev',
                         'native driver must invoke the public generated launcher')

    def test_missing_mock_keychain_is_rejected_before_spawn(self):
        c = self.admitted_fixture()
        c['command'].remove(FLAGS[0])
        with self.assertRaisesRegex(DRIVER.GateError, 'NATIVE_KEYCHAIN_FLAG_MISSING'):
            DRIVER.preflight(c)

    def test_missing_password_store_is_rejected_before_spawn(self):
        c = self.admitted_fixture()
        c['command'].remove(FLAGS[1])
        with self.assertRaisesRegex(DRIVER.GateError, 'NATIVE_KEYCHAIN_FLAG_MISSING'):
            DRIVER.preflight(c)

    def test_valid_command_admission(self):
        self.assertTrue(DRIVER.preflight(self.admitted_fixture()))

    def test_wrong_cwd_is_rejected(self):
        c = self.admitted_fixture()
        c['cwd'] = str(self.root.parent)
        with self.assertRaisesRegex(DRIVER.GateError, 'OUTSIDE_ROOT'):
            DRIVER.preflight(c)

    def test_external_writable_symlink_is_rejected(self):
        c = self.admitted_fixture()
        link = self.root / 'external-build'
        link.symlink_to(self.root.parent, target_is_directory=True)
        c['writable'].append(str(link))
        with self.assertRaisesRegex(DRIVER.GateError, 'OUTSIDE_ROOT'):
            DRIVER.preflight(c)

    def test_occupied_port_is_rejected(self):
        c = self.admitted_fixture()
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            listener.listen()
            c['ports'] = [listener.getsockname()[1]]
            with self.assertRaisesRegex(DRIVER.GateError, 'PORT_BUSY'):
                DRIVER.preflight(c)

    def test_live_registered_child_blocks_next_start(self):
        c = self.admitted_fixture()
        child = subprocess.Popen(['/bin/sleep', '20'], start_new_session=True,
                                 stdin=subprocess.DEVNULL)
        try:
            row = DRIVER.processes()[child.pid]
            print('OWNED_FIXTURE_PROCESS ' + json.dumps(row), flush=True)
            Path(c['registry']).parent.mkdir(parents=True, exist_ok=True)
            Path(c['registry']).write_text(json.dumps({'processes': [row]}))
            with self.assertRaisesRegex(DRIVER.GateError, 'REGISTERED_PROCESS_ALIVE'):
                DRIVER.preflight(c)
        finally:
            child.terminate()
            child.wait()
            print('OWNED_FIXTURE_EXIT ' + json.dumps({'pid': child.pid, 'exit': child.returncode}), flush=True)

    def test_public_launcher_really_forwards_ordered_arguments(self):
        app = self.root / "workspace with ' quote/apps/desktop"
        app.mkdir(parents=True)
        bundle = self.root / 'generated/Harness Dev.app'
        electron = bundle / 'Contents/MacOS/Electron'
        electron.parent.mkdir(parents=True)
        # An argv recorder, explicitly not Electron. Exercise the unmodified
        # public launcher shell, including quoting, spaces and actual exec.
        electron.write_text('#!' + sys.executable + '\nimport json,os,sys\n'
                            'print(json.dumps({"argv":sys.argv[1:],"home":os.environ["DSH_HOME"]}))\n')
        electron.chmod(0o700)
        options = dict(electron=str(electron), appRoot=str(app),
                       directory=str(bundle.parent), home=str(self.root / 'home'),
                       userData=str(self.root / 'user data'), mainPort=54241,
                       rendererPort=54242, hostPort=54243, openDevtools='0')
        source = OPTIONS.upstream / 'apps/desktop/scripts/development-app.ts'
        code = ('import {developmentLauncher} from ' + json.dumps(source.as_uri()) + ';\n'
                'process.stdout.write(developmentLauncher(' + json.dumps(options) + ','
                + json.dumps(str(bundle)) + '));')
        launcher_text = subprocess.check_output(
            [str(OPTIONS.node), '--input-type=module', '-e', code],
            cwd=self.root, env=CLEAN_ENV, text=True, stdin=subprocess.DEVNULL)
        launcher = electron.parent / 'HarnessDev'
        launcher.write_text(launcher_text)
        launcher.chmod(0o700)
        result = subprocess.run([str(launcher), *FLAGS], cwd=self.root,
                                env=CLEAN_ENV, text=True, capture_output=True,
                                stdin=subprocess.DEVNULL, check=True)
        row = json.loads(result.stdout)
        print('PUBLIC_LAUNCHER_FIXTURE ' + json.dumps(row), flush=True)
        self.assertEqual(row['argv'], ['--inspect=127.0.0.1:54241',
                         '--remote-debugging-port=54242',
                         '--user-data-dir=' + options['userData'], str(app), *FLAGS])
        self.assertEqual(row['home'], options['home'])

    def test_live_process_observer_reports_actual_argv_and_version(self):
        observer = getattr(DRIVER, 'observe_electron', None)
        self.assertTrue(callable(observer),
                        'NATIVE_ARGV_OBSERVER_MISSING: owned PID/start observation entry required')
        c = self.admitted_fixture()
        fake = self.root / 'fixture-electron'
        fake.write_text('#!' + sys.executable + '\nimport sys,time\n'
                        'if "--version" in sys.argv: print("fixture-electron-0")\n'
                        'else: time.sleep(20)\n')
        fake.chmod(0o700)
        child = subprocess.Popen([str(fake), *FLAGS], stdin=subprocess.DEVNULL,
                                 env=CLEAN_ENV, start_new_session=True)
        try:
            identity = DRIVER.processes()[child.pid]
            print('OWNED_FIXTURE_PROCESS ' + json.dumps(identity), flush=True)
            c['command'] = [str(fake), *FLAGS]
            row = observer(c, identity)
            for field in ['pid', 'start', 'ppid', 'pgid']:
                self.assertEqual(row[field], identity[field])
            self.assertIsInstance(row['argv'], list)
            self.assertEqual(row['argv'][-2:], FLAGS)
            self.assertEqual(row['version'], 'fixture-electron-0')
            # Planned argv is not evidence: actual child is still flagged while
            # this conflicting configuration must be rejected.
            c['command'] = [str(fake), FLAGS[0]]
            with self.assertRaises(DRIVER.GateError):
                observer(c, identity)
            stale = dict(identity, start='not the actual process start')
            with self.assertRaises(DRIVER.GateError):
                observer(c, stale)
        finally:
            child.terminate()
            child.wait()
            print('OWNED_FIXTURE_EXIT ' + json.dumps({'pid': child.pid, 'exit': child.returncode}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['driver', 'upstream', 'node', 'scratch']:
        parser.add_argument('--' + name, type=Path, required=True)
    OPTIONS = parser.parse_args()
    for name in ['driver', 'upstream', 'node', 'scratch']:
        setattr(OPTIONS, name, getattr(OPTIONS, name).resolve(strict=True))
    # These are preparation checks, not business RED. Preserve their errors if
    # the caller supplies an unavailable or wrong target instead of counting RED.
    actual = subprocess.check_output(['git', '-C', str(OPTIONS.upstream),
                                      'rev-parse', 'HEAD'], text=True).strip()
    if actual != FIXED:
        parser.error('fixed upstream mismatch: ' + actual)
    version = subprocess.check_output([str(OPTIONS.node), '--version'], text=True).strip()
    if version != 'v24.13.1':
        parser.error('test toolchain must be Node v24.13.1, got ' + version)
    CLEAN_ENV = {key: os.environ[key] for key in ['PATH', 'HOME', 'TMPDIR'] if key in os.environ}
    sys.path.insert(0, str(OPTIONS.driver.parent))
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('owned_native_driver', OPTIONS.driver)
    DRIVER = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(DRIVER)
    unittest.main(argv=[sys.argv[0]], verbosity=2)
