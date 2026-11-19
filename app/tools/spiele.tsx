import { ToolGate } from '../../src/navigation/tool-gate';
import { SpieleScreen } from '../../src/features/spiele/screen';

/** Route /tools/spiele – Vier gewinnt gegen den Computer; Zugang (Tester-Team) prüft ToolGate. */
export default function SpieleRoute() {
  return <ToolGate id="spiele"><SpieleScreen /></ToolGate>;
}
