import React, { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Folha } from '../App.tsx';
import { BotanicalLeaf } from './BotanicalLeaf.tsx';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Zap,
  Play,
  Pause,
  Search,
  Sliders,
  Volume2,
  VolumeX,
  TreeDeciduous,
} from 'lucide-react';

interface NeuralTreeProps {
  folhas: Folha[];
  selectedFolha: Folha | null;
  onSelectFolha: (folha: Folha) => void;
  onClearSelection: () => void;
  newLeafBirths?: Record<string, number>;
}

interface LeafPlacement {
  id: string;
  folha: Folha;
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  angle: number; // Rotação em graus
  scale: number;
  swayDelay: number;
  hostType: 'master' | 'bough';
  branchIdx: number;
  anchorT: number;
  bend: number;
  grainPhase: number;
}

const MASTER_BOUGHS_DEF: {
  pts: [number, number][];
  wFactor: number;
  w1: number;
  phase: number;
  edgeShade: boolean;
  subForkX: number;
  subForkY: number;
}[] = [
  // 0. Braço Mestre Esquerdo Inferior (continua a parede esquerda do tronco)
  {
    pts: [
      [0.458, 0.58],
      [0.432, 0.543],
      [0.355, 0.539],
      [0.265, 0.505],
      [0.18, 0.47],
    ],
    wFactor: 0.024,
    w1: 4.5,
    phase: 0.7,
    edgeShade: true,
    subForkX: 0.14,
    subForkY: 0.54,
  },
  // 1. Braço Mestre Esquerdo Ascendente
  {
    pts: [
      [0.474, 0.575],
      [0.464, 0.531],
      [0.39, 0.44],
      [0.32, 0.36],
      [0.26, 0.28],
    ],
    wFactor: 0.02,
    w1: 4.0,
    phase: 1.9,
    edgeShade: true,
    subForkX: 0.22,
    subForkY: 0.34,
  },
  // 2. Braço Mestre Central
  {
    pts: [
      [0.5, 0.575],
      [0.5, 0.525],
      [0.5, 0.41],
      [0.5, 0.28],
      [0.5, 0.17],
    ],
    wFactor: 0.019,
    w1: 3.8,
    phase: 3.1,
    edgeShade: false,
    subForkX: 0.44,
    subForkY: 0.25,
  },
  // 3. Braço Mestre Direito Ascendente
  {
    pts: [
      [0.526, 0.575],
      [0.536, 0.531],
      [0.61, 0.44],
      [0.68, 0.36],
      [0.74, 0.28],
    ],
    wFactor: 0.02,
    w1: 4.0,
    phase: 4.4,
    edgeShade: true,
    subForkX: 0.78,
    subForkY: 0.34,
  },
  // 4. Braço Mestre Direito Inferior (continua a parede direita do tronco)
  {
    pts: [
      [0.542, 0.58],
      [0.568, 0.543],
      [0.645, 0.539],
      [0.735, 0.505],
      [0.82, 0.47],
    ],
    wFactor: 0.024,
    w1: 4.5,
    phase: 5.5,
    edgeShade: true,
    subForkX: 0.86,
    subForkY: 0.54,
  },
];

const sampleSpline = (
  pts: { x: number; y: number }[],
  samplesPerSeg = 10
): { x: number; y: number }[] => {
  if (pts.length < 2) return pts;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      out.push({ x, y });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const evalSampledSplineWithTangent = (
  samples: { x: number; y: number }[],
  t: number
) => {
  const clamped = Math.max(0, Math.min(1, t));
  const fIdx = clamped * (samples.length - 1);
  const i0 = Math.floor(fIdx);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const frac = fIdx - i0;
  const x = samples[i0].x + (samples[i1].x - samples[i0].x) * frac;
  const y = samples[i0].y + (samples[i1].y - samples[i0].y) * frac;

  const prev = samples[Math.max(0, i0 - 1)];
  const next = samples[Math.min(samples.length - 1, i0 + 2)];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x, y, tx: dx / len, ty: dy / len };
};

const hashId = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const evalCubic = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
};

const evalCubicWithTangent = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const pt = evalCubic(p0, p1, p2, p3, t);
  const u = 1 - t;
  const dx = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: pt.x, y: pt.y, tx: dx / len, ty: dy / len };
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

// Cache global de sprites de brilho radial (evita shadowBlur e createRadialGradient por partícula)
const glowSpriteCache = new Map<string, HTMLCanvasElement>();
const getGlowSprite = (color: string): HTMLCanvasElement => {
  let sprite = glowSpriteCache.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  const size = 48;
  sprite.width = size;
  sprite.height = size;
  const sctx = sprite.getContext('2d');
  if (sctx) {
    const c = size / 2;
    const grad = sctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.22, color);
    grad.addColorStop(0.55, `${color}66`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
  }
  glowSpriteCache.set(color, sprite);
  return sprite;
};

interface CachedBranchGeom {
  lp: LeafPlacement;
  anchorPt: { x: number; y: number };
  leafPt: { x: number; y: number };
  sampled: { x: number; y: number }[];
  leftPts: { x: number; y: number }[];
  rightPts: { x: number; y: number }[];
  grainPts: { x: number; y: number }[];
  len: number;
  baseW: number;
}

interface LeafCanopyItemProps {
  lp: LeafPlacement;
  isSelected: boolean;
  isHovered: boolean;
  bloomDelay: number | undefined;
  leafW: number;
  leafH: number;
  onHoverStart: (folha: Folha) => void;
  onHoverEnd: () => void;
  onSelect: (folha: Folha) => void;
}

const LeafCanopyItem = memo(function LeafCanopyItem({
  lp,
  isSelected,
  isHovered,
  bloomDelay,
  leafW,
  leafH,
  onHoverStart,
  onHoverEnd,
  onSelect,
}: LeafCanopyItemProps) {
  const isBlooming = typeof bloomDelay === 'number';

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: `${lp.x}%`,
        top: `${lp.y}%`,
        transform: 'translate(-50%, -92%)',
        zIndex: isSelected ? 40 : isHovered ? 35 : 20,
      }}
      onMouseEnter={() => onHoverStart(lp.folha)}
      onMouseLeave={onHoverEnd}
      onClick={() => onSelect(lp.folha)}
    >
      <div
        style={{
          transformOrigin: '50% 92%',
          ...(isBlooming
            ? {
                animation: `leaf-bloom 0.85s cubic-bezier(0.22, 1.38, 0.36, 1) ${((bloomDelay + 1750) / 1000).toFixed(2)}s both`,
              }
            : {}),
        }}
      >
        <div
          style={{
            transform: `rotate(${lp.angle}deg)`,
            transformOrigin: '50% 92%',
          }}
        >
          <div
            style={{
              transformOrigin: '50% 92%',
              animation: `sway 4.8s ease-in-out infinite alternate`,
              animationDelay: `${lp.swayDelay}s`,
            }}
          >
            <div
              className={`transition-transform duration-200 ${
                isSelected ? 'scale-150' : isHovered ? 'scale-130' : 'hover:scale-115'
              }`}
              style={{ transformOrigin: '50% 92%' }}
            >
              <BotanicalLeaf
                id={lp.folha.id}
                color={lp.folha.cor}
                width={leafW}
                height={leafH}
                isSelected={isSelected}
                isHovered={isHovered}
                uidSuffix="canopy"
              />
            </div>
          </div>
        </div>
      </div>

      {isHovered && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-[#070B19]/95 border px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{ borderColor: lp.folha.cor }}
        >
          <div className="text-xs font-extrabold text-[#F8F6F0] flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: lp.folha.cor }}
            />
            {lp.folha.nome}
          </div>
          <div
            className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
            style={{ color: lp.folha.cor }}
          >
            <span>✦</span>
            {lp.folha.profissao}
          </div>
        </div>
      )}
    </div>
  );
});

export function NeuralTree({
  folhas,
  selectedFolha,
  onSelectFolha,
  onClearSelection,
  newLeafBirths = {},
}: NeuralTreeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoTourActive, setAutoTourActive] = useState(false);
  const [hoveredFolha, setHoveredFolha] = useState<Folha | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [leafSizeMultiplier, setLeafSizeMultiplier] = useState<number>(1);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [bloomDelays, setBloomDelays] = useState<Record<string, number>>({});

  // Refs estáveis para evitar reiniciar o loop do canvas ao selecionar/passar o mouse/criar folhas
  const selectedFolhaRef = useRef<Folha | null>(selectedFolha);
  const hoveredFolhaRef = useRef<Folha | null>(hoveredFolha);
  const audioEnabledRef = useRef<boolean>(audioEnabled);
  const newLeafSetRef = useRef<Set<string>>(new Set());
  const localBirthAnimRef = useRef<Record<string, { startAt: number; delay: number }>>({});
  const staticDirtyRef = useRef<boolean>(true);
  const geomDirtyRef = useRef<boolean>(true);

  selectedFolhaRef.current = selectedFolha;
  hoveredFolhaRef.current = hoveredFolha;
  audioEnabledRef.current = audioEnabled;

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Audio Context Ref (Web Audio API para som cósmico sutil no telão)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Tocar sino cósmico sutil ao focar em uma folha temporal
  const playCosmicChime = useCallback((freq = 528) => {
    if (!audioEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.8);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Ignora erro de áudio
    }
  }, []);

  // Categorias de profissões únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    folhas.forEach((f) => {
      if (f.profissao) set.add(f.profissao.trim());
    });
    return ['all', ...Array.from(set).slice(0, 6)];
  }, [folhas]);

  // Estrutura dos 12 Braços Principais da Copa conectados diretamente aos 5 braços mestres
  const timelineBoughs = useMemo(() => {
    return [
      // 1. Galho Inferior Esquerdo
      { id: 'tb_left_outer_low', masterIdx: 0, attachT: 0.42, startX: 0.44, startY: 0.54, cp1X: 0.28, cp1Y: 0.52, cp2X: 0.19, cp2Y: 0.49, endX: 0.12, endY: 0.44, width: 22, angle: -65 },
      // 2. Galho Esquerdo Médio-Baixo
      { id: 'tb_left_mid_low',   masterIdx: 0, attachT: 0.65, startX: 0.44, startY: 0.54, cp1X: 0.27, cp1Y: 0.46, cp2X: 0.21, cp2Y: 0.40, endX: 0.18, endY: 0.35, width: 20, angle: -48 },
      // 3. Galho Esquerdo Médio
      { id: 'tb_left_mid',       masterIdx: 1, attachT: 0.45, startX: 0.44, startY: 0.54, cp1X: 0.34, cp1Y: 0.41, cp2X: 0.28, cp2Y: 0.33, endX: 0.24, endY: 0.26, width: 19, angle: -35 },
      // 4. Galho Esquerdo Alto
      { id: 'tb_left_high',      masterIdx: 1, attachT: 0.72, startX: 0.48, startY: 0.52, cp1X: 0.33, cp1Y: 0.31, cp2X: 0.32, cp2Y: 0.23, endX: 0.32, endY: 0.18, width: 18, angle: -24 },
      // 5. Ápice Esquerdo da Coroa
      { id: 'tb_apex_left',      masterIdx: 2, attachT: 0.48, startX: 0.48, startY: 0.52, cp1X: 0.47, cp1Y: 0.31, cp2X: 0.43, cp2Y: 0.19, endX: 0.42, endY: 0.10, width: 17, angle: -10 },
      // 6. Corredor Interior Esquerdo
      { id: 'tb_center_inner',   masterIdx: 2, attachT: 0.34, startX: 0.49, startY: 0.52, cp1X: 0.48, cp1Y: 0.36, cp2X: 0.47, cp2Y: 0.28, endX: 0.48, endY: 0.22, width: 16, angle: -4 },
      // 7. Corredor Interior Direito
      { id: 'tb_apex_center',    masterIdx: 2, attachT: 0.34, startX: 0.51, startY: 0.52, cp1X: 0.52, cp1Y: 0.36, cp2X: 0.53, cp2Y: 0.28, endX: 0.52, endY: 0.22, width: 16, angle: 4 },
      // 8. Ápice Direito da Coroa
      { id: 'tb_apex_right',     masterIdx: 2, attachT: 0.48, startX: 0.52, startY: 0.52, cp1X: 0.53, cp1Y: 0.31, cp2X: 0.57, cp2Y: 0.19, endX: 0.58, endY: 0.10, width: 17, angle: 10 },
      // 9. Galho Direito Alto
      { id: 'tb_right_high',     masterIdx: 3, attachT: 0.72, startX: 0.52, startY: 0.52, cp1X: 0.67, cp1Y: 0.31, cp2X: 0.68, cp2Y: 0.23, endX: 0.68, endY: 0.18, width: 18, angle: 24 },
      // 10. Galho Direito Médio
      { id: 'tb_right_mid',      masterIdx: 3, attachT: 0.45, startX: 0.56, startY: 0.54, cp1X: 0.66, cp1Y: 0.41, cp2X: 0.72, cp2Y: 0.33, endX: 0.76, endY: 0.26, width: 19, angle: 35 },
      // 11. Galho Direito Médio-Baixo
      { id: 'tb_right_mid_low',  masterIdx: 4, attachT: 0.65, startX: 0.56, startY: 0.54, cp1X: 0.73, cp1Y: 0.46, cp2X: 0.79, cp2Y: 0.40, endX: 0.82, endY: 0.35, width: 20, angle: 48 },
      // 12. Galho Inferior Direito
      { id: 'tb_right_outer_low',masterIdx: 4, attachT: 0.42, startX: 0.56, startY: 0.54, cp1X: 0.72, cp1Y: 0.52, cp2X: 0.81, cp2Y: 0.49, endX: 0.88, endY: 0.44, width: 22, angle: 65 },
    ];
  }, []);

  // Amostras normalizadas dos braços mestres para distribuir galhos da base até a ponta
  const normalizedMasterSamples = useMemo(
    () =>
      MASTER_BOUGHS_DEF.map((mb) =>
        sampleSpline(
          mb.pts.map(([x, y]) => ({ x, y })),
          14
        )
      ),
    []
  );

  // Mapeamento determinístico por ID: galhos e folhas brotam ao longo de toda a extensão dos braços mestres e secundários
  const leafPlacements = useMemo(() => {
    const list: LeafPlacement[] = [];

    folhas.forEach((folha) => {
      const h = hashId(folha.id);
      const useMaster = (h >>> 2) % 10 < 3;
      const hostType: 'master' | 'bough' = useMaster ? 'master' : 'bough';

      let branchIdx = 0;
      let anchorT = 0.5;
      let anchor = { x: 0.5, y: 0.3, tx: 0, ty: -1 };

      if (useMaster) {
        branchIdx = (h >>> 5) % MASTER_BOUGHS_DEF.length;
        // Nasce desde logo acima da forquilha (0.24) até a extremidade do braço mestre (0.96)
        anchorT = 0.24 + (((h >>> 16) % 1000) / 1000) * 0.72;
        anchor = evalSampledSplineWithTangent(normalizedMasterSamples[branchIdx], anchorT);
      } else {
        branchIdx = h % timelineBoughs.length;
        const bough = timelineBoughs[branchIdx];
        const p0 = evalSampledSplineWithTangent(
          normalizedMasterSamples[bough.masterIdx],
          bough.attachT
        );
        // Nasce ao longo de toda a haste do braço secundário (0.14 até 0.98)
        anchorT = 0.14 + (((h >>> 16) % 1000) / 1000) * 0.84;
        anchor = evalCubicWithTangent(
          { x: p0.x, y: p0.y },
          { x: bough.cp1X, y: bough.cp1Y },
          { x: bough.cp2X, y: bough.cp2Y },
          { x: bough.endX, y: bough.endY },
          anchorT
        );
      }

      // Ramificação bilateral orgânica com fototropismo (cresce para os dois lados sem cair para baixo)
      const side = ((h >>> 7) & 1) === 0 ? 1 : -1;
      const nx = -anchor.ty;
      const ny = anchor.tx;

      const fwd = 0.24 + (((h >>> 11) % 100) / 100) * 0.56;
      const lat = side * (0.52 + (((h >>> 15) % 100) / 100) * 0.42);
      const liftBias = anchor.y > 0.42 ? -0.34 : -0.22;

      let dirX = anchor.tx * fwd + nx * lat;
      let dirY = anchor.ty * fwd + ny * lat + liftBias;
      // Garante que todo galho aponte para cima ou em abertura lateral suave, nunca caído
      if (dirY > -0.14) {
        dirY = -0.14 - Math.abs(dirY) * 0.35;
      }
      const dirLen = Math.hypot(dirX, dirY) || 1;
      dirX /= dirLen;
      dirY /= dirLen;

      // Alcance variado (aspecto equilibrado horizontal/vertical)
      const reach = 0.044 + (((h >>> 19) % 100) / 100) * 0.052;
      const x = Math.max(0.05, Math.min(0.95, anchor.x + dirX * reach));
      const y = Math.max(0.05, Math.min(0.54, anchor.y + dirY * reach * 0.82));

      // Sinuosidade proporcional ao comprimento do galho (S-curve natural)
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const segLen = Math.hypot(dx, dy) || 0.01;
      const ux = dx / segLen;
      const uy = dy / segLen;
      const bnx = -uy;
      const bny = ux;

      // Curvatura secundária leve oposta à saída inicial para criar sinuosidade orgânica em S
      const bend = -side * (0.11 + (((h >>> 4) % 100) / 100) * 0.14);
      const crookX = anchor.x + dx * 0.65 + bnx * (bend * segLen);
      const crookY = anchor.y + dy * 0.65 + bny * (bend * segLen) - 0.003;

      const tipDx = x - crookX;
      const tipDy = y - crookY;
      const microTilt = ((h >>> 12) % 18) - 9;
      // Folha acompanha a ponta do galho com leve elevação em direção à luz (nunca murcha/invertida)
      const rawAngle = Math.atan2(tipDx * 1.45, -tipDy) * (180 / Math.PI);
      const angle = Math.max(-74, Math.min(74, rawAngle * 0.82)) + microTilt;

      const scale = 0.92 + ((h >>> 20) % 7) * 0.065;
      const swayDelay = ((h >>> 24) % 40) / 10;
      const grainPhase = ((h >>> 9) % 628) / 100;

      list.push({
        id: folha.id,
        folha,
        x: x * 100,
        y: y * 100,
        angle,
        scale,
        swayDelay,
        hostType,
        branchIdx,
        anchorT,
        bend,
        grainPhase,
      });
    });

    return list;
  }, [folhas, timelineBoughs, normalizedMasterSamples]);

  const leafPlacementsRef = useRef<LeafPlacement[]>(leafPlacements);
  leafPlacementsRef.current = leafPlacements;

  useEffect(() => {
    geomDirtyRef.current = true;
    staticDirtyRef.current = true;
  }, [leafPlacements]);

  // Registra folhas recém-criadas para cor padrão do tronco + animação especial em 3 etapas
  useEffect(() => {
    const nowWall = Date.now();
    const nowPerf = performance.now();
    const newlyTriggered: Record<string, number> = {};
    let batchIdx = 0;

    // Se houve reset completo, limpa registros anteriores
    if (Object.keys(newLeafBirths).length === 0 && folhas.length === 0) {
      newLeafSetRef.current.clear();
      localBirthAnimRef.current = {};
      setBloomDelays({});
      staticDirtyRef.current = true;
      return;
    }

    Object.entries(newLeafBirths).forEach(([id, birthWallTs]) => {
      newLeafSetRef.current.add(id);
      if (!localBirthAnimRef.current[id] && nowWall - birthWallTs < 20000) {
        const delay = Math.min(batchIdx * 45, 1100);
        localBirthAnimRef.current[id] = { startAt: nowPerf, delay };
        newlyTriggered[id] = delay;
        batchIdx++;
      }
    });

    const ids = Object.keys(newlyTriggered);
    if (ids.length > 0) {
      staticDirtyRef.current = true;
      setBloomDelays((prev) => ({ ...prev, ...newlyTriggered }));
      const maxDelay = Math.max(...Object.values(newlyTriggered));
      const timer = setTimeout(() => {
        setBloomDelays((prev) => {
          const next = { ...prev };
          ids.forEach((id) => delete next[id]);
          return next;
        });
      }, maxDelay + 3000);
      return () => clearTimeout(timer);
    }
  }, [newLeafBirths, folhas.length]);

  // Modo Tour Automático (percorre as linhas temporais com foco suave)
  useEffect(() => {
    if (!autoTourActive || folhas.length === 0) return;

    let idx = 0;
    const interval = setInterval(() => {
      const current = folhas[idx % folhas.length];
      onSelectFolha(current);
      playCosmicChime(432 + (idx % 8) * 40);
      idx++;
    }, 5000);

    return () => clearInterval(interval);
  }, [autoTourActive, folhas, onSelectFolha, audioEnabled]);

  // RENDERIZAÇÃO GRÁFICA NO CANVAS (OTIMIZADA COM CACHE OFFSCREEN + SPRITES + DELTA TIME)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const staticCanvas = document.createElement('canvas');
    const sctx = staticCanvas.getContext('2d', { alpha: false });
    if (!sctx) return;

    let width = canvas.parentElement?.clientWidth || 1200;
    let height = canvas.parentElement?.clientHeight || 700;
    let currentDpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || window.innerWidth;
      const h = parent.clientHeight || window.innerHeight;
      if (w <= 0 || h <= 0) return;
      currentDpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      const pw = Math.round(w * currentDpr);
      const ph = Math.round(h * currentDpr);
      canvas.width = pw;
      canvas.height = ph;
      staticCanvas.width = pw;
      staticCanvas.height = ph;
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      sctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
      geomDirtyRef.current = true;
      staticDirtyRef.current = true;
    };

    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && canvas.parentElement
        ? new ResizeObserver(() => syncCanvasSize())
        : null;
    if (resizeObserver && canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Estrelas em coordenadas normalizadas (0..1) para preencher 100% da tela em tela cheia
    const stars = Array.from({ length: 160 }, () => ({
      nx: Math.random(),
      ny: Math.random(),
      size: 0.6 + Math.random() * 1.8,
      baseAlpha: 0.25 + Math.random() * 0.65,
      twinkleSpeed: 1.4 + Math.random() * 2.2,
      twinklePhase: Math.random() * Math.PI * 2,
      color: ['#F8F6F0', '#FEF08A', '#7DD3FC', '#F5C451'][Math.floor(Math.random() * 4)],
    }));

    // Pequenas partículas de pólen bioluminescente flutuando no dossel
    const pollenParticles = Array.from({ length: 18 }, (_, p) => ({
      nx: 0.15 + ((p * 0.041) % 0.7),
      ny: 0.08 + ((p * 0.023) % 0.4),
      radius: 2.0 + (p % 3) * 1.1,
      phase: p * 1.3,
    }));

    // Pulsos de energia temporal ("Nexus Surges")
    const temporalPulses = Array.from({ length: 24 }, () => ({
      boughIdx: Math.floor(Math.random() * timelineBoughs.length),
      progress: Math.random(),
      speed: 0.0035 + Math.random() * 0.005,
      size: 2.2 + Math.random() * 2.8,
      color: ['#F5C451', '#FEF08A', '#7DD3FC', '#FBBF24', '#E2E8F0'][Math.floor(Math.random() * 5)],
    }));

    // Pulsos de energia viajando pelos fios trançados do tronco
    const trunkWirePulses = Array.from({ length: 16 }, () => ({
      strandIdx: Math.floor(Math.random() * 20),
      progress: Math.random(),
      speed: 0.004 + Math.random() * 0.006,
      size: 2.0 + Math.random() * 2.5,
      color: ['#F5C451', '#FEF08A', '#7DD3FC', '#FBBF24', '#FDE68A'][Math.floor(Math.random() * 5)],
    }));

    // Poeira estelar / centelhas temporais em coordenadas normalizadas (0..1)
    const cosmicSparks = Array.from({ length: 65 }, () => ({
      nx: Math.random(),
      ny: Math.random(),
      vx: (Math.random() - 0.5) * 0.00035,
      vy: -0.00035 - Math.random() * 0.00065,
      size: 1.3 + Math.random() * 2.1,
      alpha: 0.35 + Math.random() * 0.55,
      color: ['#F5C451', '#FEF08A', '#7DD3FC', '#FBBF24', '#D97706'][Math.floor(Math.random() * 5)],
    }));

    // Caches pré-computados de geometria (recalculados apenas em resize ou mudança de folhas)
    let masterSamplesCache: { x: number; y: number }[][] = [];
    let boughCurvesCache: {
      p0: { x: number; y: number };
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      p3: { x: number; y: number };
      samples: { x: number; y: number }[];
      tb: (typeof timelineBoughs)[number];
      bIdx: number;
    }[] = [];
    let branchGeomsCache: CachedBranchGeom[] = [];
    let branchGeomById = new Map<string, CachedBranchGeom>();
    const pendingFlushIds = new Set<string>();
    let lastStaticRebuildPerf = 0;

    const evalMasterPointFromCache = (mbIdx: number, t: number) => {
      const pts = masterSamplesCache[mbIdx] || masterSamplesCache[2];
      if (!pts || pts.length === 0) return { x: width * 0.5, y: height * 0.5 };
      const fIdx = Math.max(0, Math.min(1, t)) * (pts.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(pts.length - 1, i0 + 1);
      const frac = fIdx - i0;
      return {
        x: pts[i0].x + (pts[i1].x - pts[i0].x) * frac,
        y: pts[i0].y + (pts[i1].y - pts[i0].y) * frac,
      };
    };

    const drawPrecomputedBranch = (
      targetCtx: CanvasRenderingContext2D,
      geom: CachedBranchGeom,
      isSelected: boolean,
      isHovered: boolean,
      isNewBranch: boolean
    ) => {
      const { sampled, leftPts, rightPts, grainPts } = geom;
      if (sampled.length < 2) return;
      const bStart = sampled[0];
      const bEnd = sampled[sampled.length - 1];

      // 1. Corpo de madeira orgânica com fade-in invisível na junção dentro do braço
      const woodGrad = targetCtx.createLinearGradient(bStart.x, bStart.y, bEnd.x, bEnd.y);
      if (isNewBranch) {
        woodGrad.addColorStop(0, 'rgba(19, 31, 61, 0.0)');
        woodGrad.addColorStop(0.16, '#131F3D');
        woodGrad.addColorStop(0.55, '#18284E');
        woodGrad.addColorStop(1, '#0D152B');
      } else {
        woodGrad.addColorStop(0, 'rgba(14, 23, 48, 0.0)');
        woodGrad.addColorStop(0.16, '#0E1730');
        woodGrad.addColorStop(0.6, '#0B1226');
        woodGrad.addColorStop(1, '#070C1A');
      }

      targetCtx.beginPath();
      targetCtx.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 1; i < leftPts.length; i++) targetCtx.lineTo(leftPts[i].x, leftPts[i].y);
      for (let i = rightPts.length - 1; i >= 0; i--) targetCtx.lineTo(rightPts[i].x, rightPts[i].y);
      targetCtx.closePath();
      targetCtx.fillStyle = woodGrad;
      targetCtx.fill();

      // 2. Textura de casca: sombra na borda inferior + micro-sulco longitudinal + leve luz na aresta superior
      const barkStartIdx = Math.floor(0.14 * (sampled.length - 1));
      if (barkStartIdx < sampled.length - 2) {
        targetCtx.lineCap = 'round';

        targetCtx.beginPath();
        targetCtx.moveTo(rightPts[barkStartIdx].x, rightPts[barkStartIdx].y);
        for (let i = barkStartIdx + 1; i < rightPts.length; i++) {
          targetCtx.lineTo(rightPts[i].x, rightPts[i].y);
        }
        targetCtx.strokeStyle = 'rgba(3, 5, 14, 0.56)';
        targetCtx.lineWidth = 0.95;
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.moveTo(leftPts[barkStartIdx].x, leftPts[barkStartIdx].y);
        for (let i = barkStartIdx + 1; i < leftPts.length; i++) {
          targetCtx.lineTo(leftPts[i].x, leftPts[i].y);
        }
        targetCtx.strokeStyle = isNewBranch
          ? 'rgba(245, 196, 81, 0.18)'
          : 'rgba(148, 163, 200, 0.12)';
        targetCtx.lineWidth = 0.65;
        targetCtx.stroke();

        if (grainPts.length > 2) {
          targetCtx.beginPath();
          targetCtx.moveTo(grainPts[0].x, grainPts[0].y);
          for (let i = 1; i < grainPts.length; i++) {
            targetCtx.lineTo(grainPts[i].x, grainPts[i].y);
          }
          targetCtx.strokeStyle = 'rgba(4, 7, 17, 0.48)';
          targetCtx.lineWidth = 0.6;
          targetCtx.stroke();
        }
      }

      // 3. Veio interno bem sutil (intensifica apenas em seleção ou hover)
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.moveTo(sampled[0].x, sampled[0].y);
      for (let i = 1; i < sampled.length; i++) {
        targetCtx.lineTo(sampled[i].x, sampled[i].y);
      }
      targetCtx.lineCap = 'round';
      if (isSelected) {
        targetCtx.strokeStyle = '#FEF08A';
        targetCtx.lineWidth = 1.9;
        targetCtx.shadowColor = '#FEF08A';
        targetCtx.shadowBlur = 10;
      } else if (isHovered) {
        targetCtx.strokeStyle = geom.lp.folha.cor;
        targetCtx.lineWidth = 1.4;
        targetCtx.shadowColor = geom.lp.folha.cor;
        targetCtx.shadowBlur = 8;
      } else if (isNewBranch) {
        const subtleVeinGrad = targetCtx.createLinearGradient(bStart.x, bStart.y, bEnd.x, bEnd.y);
        subtleVeinGrad.addColorStop(0, 'rgba(245, 196, 81, 0.0)');
        subtleVeinGrad.addColorStop(0.22, 'rgba(245, 196, 81, 0.22)');
        subtleVeinGrad.addColorStop(0.85, 'rgba(254, 240, 138, 0.14)');
        subtleVeinGrad.addColorStop(1, 'rgba(254, 240, 138, 0.04)');
        targetCtx.strokeStyle = subtleVeinGrad;
        targetCtx.lineWidth = 0.7;
      } else {
        const subtleArmVein = targetCtx.createLinearGradient(bStart.x, bStart.y, bEnd.x, bEnd.y);
        subtleArmVein.addColorStop(0, 'rgba(148, 163, 200, 0.0)');
        subtleArmVein.addColorStop(0.25, 'rgba(148, 163, 200, 0.15)');
        subtleArmVein.addColorStop(1, 'rgba(148, 163, 200, 0.04)');
        targetCtx.strokeStyle = subtleArmVein;
        targetCtx.lineWidth = 0.6;
      }
      targetCtx.stroke();
      targetCtx.restore();
    };

    const drawGrowingBranch = (
      targetCtx: CanvasRenderingContext2D,
      sampledSub: { x: number; y: number }[],
      baseW: number,
      grainPhase: number,
      tipScale: number
    ) => {
      if (sampledSub.length < 2) return;
      const bStart = sampledSub[0];
      const bEnd = sampledSub[sampledSub.length - 1];
      const endW = 1.15 * tipScale;
      const leftPts: { x: number; y: number }[] = [];
      const rightPts: { x: number; y: number }[] = [];

      for (let i = 0; i < sampledSub.length; i++) {
        const t = i / (sampledSub.length - 1);
        const prev = sampledSub[Math.max(0, i - 1)];
        const next = sampledSub[Math.min(sampledSub.length - 1, i + 1)];
        const sdx = next.x - prev.x;
        const sdy = next.y - prev.y;
        const sdist = Math.hypot(sdx, sdy) || 1;
        const snx = -sdy / sdist;
        const sny = sdx / sdist;
        const collarFlare = 1 + 0.22 * Math.exp(-t * 11);
        const barkIrregularity =
          1 + Math.sin(t * Math.PI * 5 + grainPhase) * 0.055 * (1 - t * 0.5);
        const halfW = (baseW * Math.pow(1 - t, 0.88) + endW * t) * 0.5 * collarFlare * barkIrregularity;
        leftPts.push({ x: sampledSub[i].x + snx * halfW, y: sampledSub[i].y + sny * halfW });
        rightPts.push({ x: sampledSub[i].x - snx * halfW, y: sampledSub[i].y - sny * halfW });
      }

      const woodGrad = targetCtx.createLinearGradient(bStart.x, bStart.y, bEnd.x, bEnd.y);
      woodGrad.addColorStop(0, 'rgba(19, 31, 61, 0.0)');
      woodGrad.addColorStop(0.16, '#131F3D');
      woodGrad.addColorStop(0.55, '#18284E');
      woodGrad.addColorStop(1, '#0D152B');

      targetCtx.beginPath();
      targetCtx.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 1; i < leftPts.length; i++) targetCtx.lineTo(leftPts[i].x, leftPts[i].y);
      for (let i = rightPts.length - 1; i >= 0; i--) targetCtx.lineTo(rightPts[i].x, rightPts[i].y);
      targetCtx.closePath();
      targetCtx.fillStyle = woodGrad;
      targetCtx.fill();
    };

    const rebuildGeometryCache = () => {
      masterSamplesCache = MASTER_BOUGHS_DEF.map((def) =>
        sampleSpline(
          def.pts.map(([nx, ny]) => ({ x: nx * width, y: ny * height })),
          14
        )
      );

      boughCurvesCache = timelineBoughs.map((tb, bIdx) => {
        const p0 = evalMasterPointFromCache(tb.masterIdx, tb.attachT);
        const p1 = { x: tb.cp1X * width, y: tb.cp1Y * height };
        const p2 = { x: tb.cp2X * width, y: tb.cp2Y * height };
        const p3 = { x: tb.endX * width, y: tb.endY * height };
        const samples: { x: number; y: number }[] = [];
        for (let s = 0; s <= 24; s++) {
          samples.push(evalCubic(p0, p1, p2, p3, s / 24));
        }
        return { p0, p1, p2, p3, samples, tb, bIdx };
      });

      branchGeomsCache = [];
      branchGeomById = new Map();

      leafPlacementsRef.current.forEach((lp) => {
        const isMasterHost = lp.hostType === 'master';
        const bc = isMasterHost ? null : boughCurvesCache[lp.branchIdx] || boughCurvesCache[0];
        const anchorInfo = isMasterHost
          ? evalSampledSplineWithTangent(
              masterSamplesCache[lp.branchIdx] || masterSamplesCache[0],
              lp.anchorT
            )
          : evalCubicWithTangent(bc!.p0, bc!.p1, bc!.p2, bc!.p3, lp.anchorT);
        const anchorPt = { x: anchorInfo.x, y: anchorInfo.y };
        const leafPt = { x: (lp.x / 100) * width, y: (lp.y / 100) * height };

        const dx = leafPt.x - anchorPt.x;
        const dy = leafPt.y - anchorPt.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;

        const sDirX = anchorInfo.tx * 0.66 + ux * 0.34;
        const sDirY = anchorInfo.ty * 0.66 + uy * 0.34;
        const sLen = Math.hypot(sDirX, sDirY) || 1;
        const shoulderPt = {
          x: anchorPt.x + (sDirX / sLen) * (len * 0.28),
          y: anchorPt.y + (sDirY / sLen) * (len * 0.28),
        };
        const crookPt = {
          x: anchorPt.x + dx * 0.65 + nx * (lp.bend * len),
          y: anchorPt.y + dy * 0.65 + ny * (lp.bend * len) - 3,
        };

        const sampled = sampleSpline([anchorPt, shoulderPt, crookPt, leafPt], 10);
        const baseW = Math.max(3.8, Math.min(6.4, len * 0.068));
        const endW = 1.15;
        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];
        const grainPts: { x: number; y: number }[] = [];

        for (let i = 0; i < sampled.length; i++) {
          const t = i / (sampled.length - 1);
          const prev = sampled[Math.max(0, i - 1)];
          const next = sampled[Math.min(sampled.length - 1, i + 1)];
          const sdx = next.x - prev.x;
          const sdy = next.y - prev.y;
          const sdist = Math.hypot(sdx, sdy) || 1;
          const snx = -sdy / sdist;
          const sny = sdx / sdist;

          const collarFlare = 1 + 0.22 * Math.exp(-t * 11);
          const barkIrregularity =
            1 + Math.sin(t * Math.PI * 5 + lp.grainPhase) * 0.055 * (1 - t * 0.5);
          const taper = baseW * Math.pow(1 - t, 0.88) + endW * t;
          const halfW = taper * 0.5 * collarFlare * barkIrregularity;

          leftPts.push({ x: sampled[i].x + snx * halfW, y: sampled[i].y + sny * halfW });
          rightPts.push({ x: sampled[i].x - snx * halfW, y: sampled[i].y - sny * halfW });
          if (t >= 0.14 && t <= 0.82) {
            grainPts.push({
              x: sampled[i].x + snx * halfW * 0.32,
              y: sampled[i].y + sny * halfW * 0.32,
            });
          }
        }

        const geom: CachedBranchGeom = {
          lp,
          anchorPt,
          leafPt,
          sampled,
          leftPts,
          rightPts,
          grainPts,
          len,
          baseW,
        };
        branchGeomsCache.push(geom);
        branchGeomById.set(lp.folha.id, geom);
      });

      geomDirtyRef.current = false;
    };

    const rebuildStaticScene = () => {
      if (geomDirtyRef.current) {
        rebuildGeometryCache();
      }

      sctx.clearRect(0, 0, width, height);

      // 1. ESPAÇO CÓSMICO E NEBULOSAS DO FIM DOS TEMPOS
      const fullRadius = Math.hypot(width, height) * 0.68;
      const bgGrad = sctx.createRadialGradient(
        width * 0.5,
        height * 0.52,
        Math.min(width, height) * 0.04,
        width * 0.5,
        height * 0.50,
        fullRadius
      );
      bgGrad.addColorStop(0, '#0E1733');
      bgGrad.addColorStop(0.28, '#0A1128');
      bgGrad.addColorStop(0.58, '#070B19');
      bgGrad.addColorStop(0.86, '#040711');
      bgGrad.addColorStop(1, '#02040A');
      sctx.fillStyle = bgGrad;
      sctx.fillRect(0, 0, width, height);

      const drawAuroraGlow = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        rot: number,
        colorStart: string,
        colorMid: string
      ) => {
        if (rx <= 0 || ry <= 0) return;
        sctx.save();
        sctx.translate(cx, cy);
        sctx.rotate(rot);
        sctx.scale(1, ry / rx);
        const grad = sctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        grad.addColorStop(0, colorStart);
        grad.addColorStop(0.52, colorMid);
        grad.addColorStop(1, 'transparent');
        sctx.fillStyle = grad;
        sctx.beginPath();
        sctx.arc(0, 0, rx, 0, Math.PI * 2);
        sctx.fill();
        sctx.restore();
      };

      drawAuroraGlow(
        width * 0.5,
        height * 0.45,
        width * 0.72,
        height * 0.62,
        0,
        'rgba(30, 48, 96, 0.22)',
        'rgba(56, 189, 248, 0.06)'
      );
      drawAuroraGlow(
        width * 0.5,
        height * 0.28,
        width * 0.56,
        height * 0.42,
        0,
        'rgba(245, 196, 81, 0.14)',
        'rgba(99, 102, 241, 0.07)'
      );
      drawAuroraGlow(
        width * 0.22,
        height * 0.30,
        width * 0.44,
        height * 0.40,
        -0.18,
        'rgba(56, 189, 248, 0.14)',
        'rgba(30, 64, 175, 0.06)'
      );
      drawAuroraGlow(
        width * 0.78,
        height * 0.30,
        width * 0.44,
        height * 0.40,
        0.18,
        'rgba(99, 102, 241, 0.14)',
        'rgba(56, 189, 248, 0.05)'
      );
      drawAuroraGlow(
        width * 0.5,
        height * 0.62,
        width * 0.38,
        height * 0.28,
        0,
        'rgba(254, 240, 138, 0.18)',
        'rgba(217, 119, 6, 0.06)'
      );
      drawAuroraGlow(
        width * 0.5,
        height * 0.88,
        width * 0.66,
        height * 0.36,
        0,
        'rgba(245, 196, 81, 0.11)',
        'rgba(56, 189, 248, 0.04)'
      );

      // 2. DOSSEL DE FOLHAGEM ORGÂNICA DA COPA
      const foliageClusters = [
        { cx: 0.50, cy: 0.22, rx: 0.28, ry: 0.16, alpha: 0.55, color: '#0B1226' },
        { cx: 0.50, cy: 0.19, rx: 0.24, ry: 0.14, alpha: 0.65, color: '#0F1933' },
        { cx: 0.50, cy: 0.16, rx: 0.19, ry: 0.11, alpha: 0.50, color: '#142142' },
        { cx: 0.32, cy: 0.28, rx: 0.20, ry: 0.15, alpha: 0.50, color: '#0A1124' },
        { cx: 0.24, cy: 0.35, rx: 0.17, ry: 0.13, alpha: 0.45, color: '#0E1730' },
        { cx: 0.16, cy: 0.42, rx: 0.14, ry: 0.10, alpha: 0.40, color: '#0C142B' },
        { cx: 0.36, cy: 0.19, rx: 0.17, ry: 0.12, alpha: 0.55, color: '#121E3D' },
        { cx: 0.27, cy: 0.24, rx: 0.16, ry: 0.12, alpha: 0.50, color: '#16254A' },
        { cx: 0.68, cy: 0.28, rx: 0.20, ry: 0.15, alpha: 0.50, color: '#0A1124' },
        { cx: 0.76, cy: 0.35, rx: 0.17, ry: 0.13, alpha: 0.45, color: '#0E1730' },
        { cx: 0.84, cy: 0.42, rx: 0.14, ry: 0.10, alpha: 0.40, color: '#0C142B' },
        { cx: 0.64, cy: 0.19, rx: 0.17, ry: 0.12, alpha: 0.55, color: '#121E3D' },
        { cx: 0.73, cy: 0.24, rx: 0.16, ry: 0.12, alpha: 0.50, color: '#16254A' },
        { cx: 0.43, cy: 0.12, rx: 0.15, ry: 0.08, alpha: 0.55, color: '#182952' },
        { cx: 0.57, cy: 0.12, rx: 0.15, ry: 0.08, alpha: 0.55, color: '#182952' },
        { cx: 0.50, cy: 0.09, rx: 0.14, ry: 0.06, alpha: 0.60, color: '#1C305E' },
        { cx: 0.50, cy: 0.07, rx: 0.10, ry: 0.05, alpha: 0.45, color: '#21386B' },
      ];

      foliageClusters.forEach((fc) => {
        const cx = fc.cx * width;
        const cy = fc.cy * height;
        const rx = fc.rx * width;
        const ry = fc.ry * height;
        const grad = sctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
        grad.addColorStop(0, fc.color);
        grad.addColorStop(0.7, fc.color);
        grad.addColorStop(1, 'transparent');
        sctx.fillStyle = grad;
        sctx.globalAlpha = fc.alpha;
        sctx.beginPath();
        sctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.globalAlpha = 1;
      });

      // Nuvem dourada translúcida suave envolvendo a copa atrás dos galhos (tom contido)
      const goldenBackClouds = [
        { cx: 0.50, cy: 0.25, rx: 0.34, ry: 0.18, inner: 'rgba(245, 196, 81, 0.11)', mid: 'rgba(217, 119, 6, 0.045)' },
        { cx: 0.31, cy: 0.29, rx: 0.22, ry: 0.14, inner: 'rgba(245, 196, 81, 0.09)', mid: 'rgba(217, 119, 6, 0.035)' },
        { cx: 0.69, cy: 0.29, rx: 0.22, ry: 0.14, inner: 'rgba(245, 196, 81, 0.09)', mid: 'rgba(217, 119, 6, 0.035)' },
        { cx: 0.50, cy: 0.15, rx: 0.24, ry: 0.12, inner: 'rgba(253, 230, 138, 0.08)', mid: 'rgba(245, 196, 81, 0.03)' },
      ];
      goldenBackClouds.forEach((gc) => {
        drawAuroraGlow(
          width * gc.cx,
          height * gc.cy,
          width * gc.rx,
          height * gc.ry,
          0,
          gc.inner,
          gc.mid
        );
      });

      // 3. TRONCO ESCULPIDO, RAÍZES E BRAÇOS
      const trunkCenterX = width * 0.5;
      const groundY = height * 0.90;
      const trunkMidY = height * 0.66;
      const crotchY = height * 0.535;
      const rootMergeY = height * 0.80;

      const drawTaperedSpline = (
        pts: { x: number; y: number }[],
        wStart: number,
        wEnd: number,
        fillStyle: string | CanvasGradient,
        knotPhase = 0,
        softStart = false,
        creviceStartT = 0
      ) => {
        const sampled = sampleSpline(pts, 12);
        if (sampled.length < 2) return;
        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];

        for (let i = 0; i < sampled.length; i++) {
          const t = i / (sampled.length - 1);
          const prev = sampled[Math.max(0, i - 1)];
          const next = sampled[Math.min(sampled.length - 1, i + 1)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const knot = 1 + Math.sin(t * Math.PI * 3.5 + knotPhase) * 0.12 * (1 - t * 0.6);
          const taper = wStart * Math.pow(1 - t, 0.82) + wEnd * t;
          const capScale = softStart && t < 0.08 ? 0.45 + 0.55 * (t / 0.08) : 1;
          const halfW = taper * 0.5 * knot * capScale;
          leftPts.push({ x: sampled[i].x + nx * halfW, y: sampled[i].y + ny * halfW });
          rightPts.push({ x: sampled[i].x - nx * halfW, y: sampled[i].y - ny * halfW });
        }

        sctx.beginPath();
        sctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) sctx.lineTo(leftPts[i].x, leftPts[i].y);
        for (let i = rightPts.length - 1; i >= 0; i--) sctx.lineTo(rightPts[i].x, rightPts[i].y);
        sctx.closePath();
        sctx.fillStyle = fillStyle;
        sctx.fill();

        if (creviceStartT > 0) {
          const startIdx = Math.floor(creviceStartT * (sampled.length - 1));
          if (startIdx < sampled.length - 2) {
            sctx.save();
            sctx.strokeStyle = 'rgba(3, 5, 14, 0.56)';
            sctx.lineWidth = 1.6;
            sctx.lineCap = 'round';
            sctx.beginPath();
            sctx.moveTo(leftPts[startIdx].x, leftPts[startIdx].y);
            for (let i = startIdx + 1; i < leftPts.length; i++) {
              sctx.lineTo(leftPts[i].x, leftPts[i].y);
            }
            sctx.stroke();

            sctx.beginPath();
            sctx.moveTo(rightPts[startIdx].x, rightPts[startIdx].y);
            for (let i = startIdx + 1; i < rightPts.length; i++) {
              sctx.lineTo(rightPts[i].x, rightPts[i].y);
            }
            sctx.stroke();
            sctx.restore();
          }
        }
      };

      const traceSplinePath = (pts: { x: number; y: number }[]) => {
        const sampled = sampleSpline(pts, 12);
        if (sampled.length < 2) return;
        sctx.beginPath();
        sctx.moveTo(sampled[0].x, sampled[0].y);
        for (let i = 1; i < sampled.length; i++) {
          sctx.lineTo(sampled[i].x, sampled[i].y);
        }
      };

      const voidGlow = sctx.createRadialGradient(
        trunkCenterX,
        groundY,
        width * 0.03,
        trunkCenterX,
        groundY,
        Math.max(width, height) * 0.52
      );
      voidGlow.addColorStop(0, 'rgba(245, 196, 81, 0.14)');
      voidGlow.addColorStop(0.45, 'rgba(99, 102, 241, 0.08)');
      voidGlow.addColorStop(0.8, 'rgba(56, 189, 248, 0.03)');
      voidGlow.addColorStop(1, 'transparent');
      sctx.fillStyle = voidGlow;
      sctx.fillRect(0, 0, width, height);

      const sculptedRoots: {
        pts: [number, number][];
        wFactor: number;
        w1: number;
        phase: number;
        edgeShade: boolean;
        cyanVein?: boolean;
        forks?: { pts: [number, number][]; wFactor: number; w1: number; phase: number; vein?: boolean }[];
      }[] = [
        {
          pts: [
            [0.456, 0.722],
            [0.438, 0.792],
            [0.382, 0.848],
            [0.305, 0.895],
            [0.242, 0.970],
            [0.162, 1.075],
          ],
          wFactor: 0.031,
          w1: 4.0,
          phase: 0.5,
          edgeShade: true,
          cyanVein: true,
          forks: [
            {
              pts: [
                [0.348, 0.862],
                [0.278, 0.882],
                [0.205, 0.928],
                [0.145, 0.970],
                [0.095, 1.05],
              ],
              wFactor: 0.011,
              w1: 2.0,
              phase: 1.1,
              vein: true,
            },
            {
              pts: [
                [0.260, 0.950],
                [0.285, 0.998],
                [0.268, 1.048],
                [0.285, 1.11],
              ],
              wFactor: 0.0085,
              w1: 1.6,
              phase: 2.3,
            },
          ],
        },
        {
          pts: [
            [0.472, 0.732],
            [0.458, 0.798],
            [0.415, 0.865],
            [0.368, 0.928],
            [0.312, 0.990],
            [0.270, 1.095],
          ],
          wFactor: 0.027,
          w1: 3.6,
          phase: 1.6,
          edgeShade: true,
          forks: [
            {
              pts: [
                [0.378, 0.912],
                [0.398, 0.968],
                [0.372, 1.028],
                [0.388, 1.11],
              ],
              wFactor: 0.010,
              w1: 1.8,
              phase: 2.9,
              vein: true,
            },
          ],
        },
        {
          pts: [
            [0.488, 0.740],
            [0.478, 0.804],
            [0.454, 0.885],
            [0.466, 0.955],
            [0.432, 1.028],
            [0.412, 1.12],
          ],
          wFactor: 0.025,
          w1: 3.4,
          phase: 2.8,
          edgeShade: false,
          forks: [
            {
              pts: [
                [0.458, 0.915],
                [0.422, 0.968],
                [0.402, 1.03],
                [0.365, 1.11],
              ],
              wFactor: 0.0085,
              w1: 1.6,
              phase: 0.8,
            },
          ],
        },
        {
          pts: [
            [0.502, 0.742],
            [0.500, 0.805],
            [0.492, 0.882],
            [0.516, 0.955],
            [0.498, 1.035],
            [0.514, 1.13],
          ],
          wFactor: 0.026,
          w1: 3.6,
          phase: 4.1,
          edgeShade: false,
          cyanVein: true,
          forks: [
            {
              pts: [
                [0.498, 0.895],
                [0.478, 0.965],
                [0.492, 1.035],
                [0.475, 1.12],
              ],
              wFactor: 0.009,
              w1: 1.8,
              phase: 3.5,
              vein: true,
            },
          ],
        },
        {
          pts: [
            [0.516, 0.738],
            [0.522, 0.802],
            [0.558, 0.875],
            [0.548, 0.945],
            [0.584, 1.018],
            [0.596, 1.12],
          ],
          wFactor: 0.025,
          w1: 3.4,
          phase: 5.0,
          edgeShade: false,
          forks: [
            {
              pts: [
                [0.558, 0.895],
                [0.538, 0.965],
                [0.556, 1.03],
                [0.545, 1.11],
              ],
              wFactor: 0.0085,
              w1: 1.6,
              phase: 1.4,
            },
          ],
        },
        {
          pts: [
            [0.530, 0.732],
            [0.542, 0.796],
            [0.594, 0.858],
            [0.638, 0.925],
            [0.692, 0.988],
            [0.728, 1.09],
          ],
          wFactor: 0.027,
          w1: 3.6,
          phase: 6.1,
          edgeShade: true,
          forks: [
            {
              pts: [
                [0.625, 0.905],
                [0.618, 0.975],
                [0.648, 1.035],
                [0.645, 1.12],
              ],
              wFactor: 0.010,
              w1: 1.8,
              phase: 4.2,
              vein: true,
            },
          ],
        },
        {
          pts: [
            [0.544, 0.722],
            [0.562, 0.790],
            [0.628, 0.848],
            [0.698, 0.892],
            [0.774, 0.962],
            [0.858, 1.075],
          ],
          wFactor: 0.031,
          w1: 4.0,
          phase: 2.2,
          edgeShade: true,
          cyanVein: true,
          forks: [
            {
              pts: [
                [0.682, 0.878],
                [0.745, 0.908],
                [0.808, 0.948],
                [0.882, 1.04],
              ],
              wFactor: 0.011,
              w1: 1.8,
              phase: 5.7,
              vein: true,
            },
            {
              pts: [
                [0.735, 0.928],
                [0.725, 0.988],
                [0.758, 1.045],
                [0.768, 1.11],
              ],
              wFactor: 0.0085,
              w1: 1.6,
              phase: 0.9,
            },
          ],
        },
      ];

      const backRoots: { pts: [number, number][]; wFactor: number; w1: number; phase: number }[] = [
        {
          pts: [
            [0.452, 0.76],
            [0.415, 0.82],
            [0.365, 0.86],
            [0.275, 0.93],
            [0.215, 0.99],
            [0.145, 1.09],
          ],
          wFactor: 0.016,
          w1: 3.0,
          phase: 0.4,
        },
        {
          pts: [
            [0.474, 0.77],
            [0.448, 0.84],
            [0.415, 0.91],
            [0.372, 0.98],
            [0.352, 1.09],
          ],
          wFactor: 0.014,
          w1: 2.5,
          phase: 1.9,
        },
        {
          pts: [
            [0.496, 0.775],
            [0.484, 0.86],
            [0.498, 0.94],
            [0.468, 1.01],
            [0.456, 1.12],
          ],
          wFactor: 0.013,
          w1: 2.5,
          phase: 3.1,
        },
        {
          pts: [
            [0.522, 0.77],
            [0.538, 0.85],
            [0.578, 0.92],
            [0.605, 0.99],
            [0.642, 1.11],
          ],
          wFactor: 0.014,
          w1: 2.5,
          phase: 4.5,
        },
        {
          pts: [
            [0.546, 0.76],
            [0.592, 0.82],
            [0.665, 0.88],
            [0.728, 0.95],
            [0.825, 1.08],
          ],
          wFactor: 0.015,
          w1: 3.0,
          phase: 5.4,
        },
      ];

      backRoots.forEach((rt) => {
        drawTaperedSpline(
          rt.pts.map(([px, py]) => ({ x: px * width, y: py * height })),
          Math.max(12, width * rt.wFactor),
          rt.w1,
          '#070B19',
          rt.phase,
          true
        );
      });

      const buildTrunkPath = () => {
        sctx.beginPath();
        sctx.moveTo(width * 0.432, rootMergeY);
        sctx.bezierCurveTo(
          width * 0.444,
          height * 0.745,
          width * 0.454,
          height * 0.70,
          width * 0.456,
          trunkMidY
        );
        sctx.bezierCurveTo(
          width * 0.460,
          crotchY + (trunkMidY - crotchY) * 0.48,
          width * 0.442,
          crotchY + 16,
          width * 0.425,
          crotchY + 4
        );
        sctx.bezierCurveTo(
          width * 0.455,
          crotchY - 8,
          width * 0.480,
          crotchY - 12,
          trunkCenterX,
          crotchY - 14
        );
        sctx.bezierCurveTo(
          width * 0.520,
          crotchY - 12,
          width * 0.545,
          crotchY - 8,
          width * 0.575,
          crotchY + 4
        );
        sctx.bezierCurveTo(
          width * 0.558,
          crotchY + 16,
          width * 0.540,
          crotchY + (trunkMidY - crotchY) * 0.48,
          width * 0.544,
          trunkMidY
        );
        sctx.bezierCurveTo(
          width * 0.546,
          height * 0.70,
          width * 0.556,
          height * 0.745,
          width * 0.568,
          rootMergeY
        );
        sctx.quadraticCurveTo(trunkCenterX, rootMergeY - 6, width * 0.432, rootMergeY);
        sctx.closePath();
      };

      sctx.save();
      buildTrunkPath();
      const trunkGrad = sctx.createLinearGradient(
        trunkCenterX,
        rootMergeY,
        trunkCenterX,
        crotchY - 16
      );
      trunkGrad.addColorStop(0, '#0C1326');
      trunkGrad.addColorStop(0.45, '#131F3D');
      trunkGrad.addColorStop(1, '#1A2A52');
      sctx.fillStyle = trunkGrad;
      sctx.shadowColor = 'rgba(245, 196, 81, 0.25)';
      sctx.shadowBlur = 18;
      sctx.fill();
      sctx.restore();

      sctx.save();
      buildTrunkPath();
      sctx.clip();
      const cylGrad = sctx.createLinearGradient(width * 0.40, 0, width * 0.60, 0);
      cylGrad.addColorStop(0, 'rgba(4, 7, 17, 0.80)');
      cylGrad.addColorStop(0.28, 'rgba(13, 21, 43, 0.26)');
      cylGrad.addColorStop(0.48, 'rgba(245, 196, 81, 0.14)');
      cylGrad.addColorStop(0.72, 'rgba(13, 21, 43, 0.30)');
      cylGrad.addColorStop(1, 'rgba(4, 7, 17, 0.84)');
      sctx.fillStyle = cylGrad;
      sctx.fillRect(width * 0.35, crotchY - 25, width * 0.30, rootMergeY - crotchY + 35);
      sctx.restore();

      sculptedRoots.forEach((rt) => {
        const rootPts = rt.pts.map(([px, py]) => ({ x: px * width, y: py * height }));
        const startPt = rootPts[0];
        const endPt = rootPts[rootPts.length - 1];
        const baseW = Math.max(20, width * rt.wFactor);

        rt.forks?.forEach((fk) => {
          const fkPts = fk.pts.map(([px, py]) => ({ x: px * width, y: py * height }));
          const fkGrad = sctx.createLinearGradient(
            fkPts[0].x,
            fkPts[0].y,
            fkPts[fkPts.length - 1].x,
            fkPts[fkPts.length - 1].y
          );
          fkGrad.addColorStop(0, '#111C38');
          fkGrad.addColorStop(1, '#060A17');
          drawTaperedSpline(fkPts, Math.max(8, width * fk.wFactor), fk.w1, fkGrad, fk.phase, true, 0.14);

          if (fk.vein) {
            sctx.save();
            traceSplinePath(fkPts);
            const fkVein = sctx.createLinearGradient(
              fkPts[0].x,
              fkPts[0].y,
              fkPts[fkPts.length - 1].x,
              fkPts[fkPts.length - 1].y
            );
            fkVein.addColorStop(0, 'rgba(245, 196, 81, 0.42)');
            fkVein.addColorStop(1, 'rgba(245, 196, 81, 0.08)');
            sctx.strokeStyle = fkVein;
            sctx.lineWidth = 1.0;
            sctx.shadowColor = '#F5C451';
            sctx.shadowBlur = 5;
            sctx.stroke();
            sctx.restore();
          }
        });

        const rootGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        if (rt.edgeShade) {
          rootGrad.addColorStop(0, 'rgba(12, 19, 38, 0.0)');
          rootGrad.addColorStop(0.15, '#0B1226');
          rootGrad.addColorStop(0.45, '#090F20');
          rootGrad.addColorStop(1, '#050812');
        } else {
          rootGrad.addColorStop(0, 'rgba(19, 31, 61, 0.0)');
          rootGrad.addColorStop(0.15, '#121D3A');
          rootGrad.addColorStop(0.45, '#0D152B');
          rootGrad.addColorStop(1, '#060A17');
        }
        drawTaperedSpline(rootPts, baseW, rt.w1, rootGrad, rt.phase, true, 0.18);

        const highlightPts = rootPts.map((p) => ({ x: p.x, y: p.y - 1.5 }));
        const hiGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        hiGrad.addColorStop(0, 'rgba(245, 196, 81, 0.0)');
        hiGrad.addColorStop(0.18, 'rgba(245, 196, 81, 0.20)');
        hiGrad.addColorStop(0.85, 'rgba(148, 163, 200, 0.07)');
        hiGrad.addColorStop(1, 'rgba(245, 196, 81, 0.0)');
        drawTaperedSpline(highlightPts, baseW * 0.34, 0.8, hiGrad, rt.phase + 0.5, true);
      });

      const strandNorms = [-0.78, -0.52, -0.26, 0.0, 0.26, 0.52, 0.78];
      sculptedRoots.forEach((rt, idx) => {
        const norm = strandNorms[idx] ?? 0;
        const topX = trunkCenterX + norm * (width * 0.062);
        const waistX =
          trunkCenterX + (norm * 0.82 + Math.sin(idx * 1.4) * 0.08) * (width * 0.040);

        const rootPts = rt.pts.map(([px, py]) => ({ x: px * width, y: py * height }));
        const continuousPts = [
          { x: topX, y: crotchY - 8 },
          { x: waistX, y: trunkMidY },
          ...rootPts,
        ];
        const startPt = continuousPts[0];
        const endPt = continuousPts[continuousPts.length - 1];

        sctx.save();
        traceSplinePath(continuousPts);
        const grooveGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        grooveGrad.addColorStop(0, 'rgba(3, 5, 14, 0.84)');
        grooveGrad.addColorStop(0.5, 'rgba(3, 5, 14, 0.56)');
        grooveGrad.addColorStop(1, 'rgba(3, 5, 14, 0.16)');
        sctx.strokeStyle = grooveGrad;
        sctx.lineWidth = idx === 0 || idx === 6 ? 2.4 : 3.0;
        sctx.lineCap = 'round';
        sctx.lineJoin = 'round';
        sctx.stroke();

        traceSplinePath(continuousPts.map((p) => ({ x: p.x + 1.5, y: p.y })));
        const ridgeGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        ridgeGrad.addColorStop(0, 'rgba(226, 232, 240, 0.22)');
        ridgeGrad.addColorStop(0.5, 'rgba(245, 196, 81, 0.14)');
        ridgeGrad.addColorStop(1, 'rgba(245, 196, 81, 0.03)');
        sctx.strokeStyle = ridgeGrad;
        sctx.lineWidth = 1.1;
        sctx.stroke();

        traceSplinePath(continuousPts.map((p) => ({ x: p.x + 0.5, y: p.y })));
        const veinGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        if (idx === 3) {
          veinGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
          veinGrad.addColorStop(0.45, 'rgba(245, 196, 81, 0.48)');
          veinGrad.addColorStop(1, 'rgba(245, 196, 81, 0.10)');
        } else if (rt.cyanVein) {
          veinGrad.addColorStop(0, 'rgba(245, 196, 81, 0.40)');
          veinGrad.addColorStop(0.45, 'rgba(125, 211, 252, 0.42)');
          veinGrad.addColorStop(1, 'rgba(245, 196, 81, 0.08)');
        } else {
          const baseAlpha = idx % 2 === 1 ? 0.50 : 0.32;
          veinGrad.addColorStop(0, `rgba(245, 196, 81, ${baseAlpha})`);
          veinGrad.addColorStop(0.55, 'rgba(245, 196, 81, 0.28)');
          veinGrad.addColorStop(1, 'rgba(245, 196, 81, 0.08)');
        }
        sctx.strokeStyle = veinGrad;
        sctx.lineWidth = idx % 2 === 1 ? 1.25 : 0.95;
        sctx.shadowColor = '#F5C451';
        sctx.shadowBlur = 7;
        sctx.stroke();
        sctx.restore();
      });

      sctx.save();
      const leftEdgePts = [
        { x: width * 0.425, y: crotchY + 4 },
        { x: width * 0.455, y: trunkMidY },
        ...sculptedRoots[0].pts.slice(1).map(([px, py], i) => ({
          x: px * width - Math.max(8, width * 0.013) * Math.pow(0.76, i),
          y: py * height,
        })),
      ];
      traceSplinePath(leftEdgePts);
      const leftRimGrad = sctx.createLinearGradient(
        leftEdgePts[0].x,
        leftEdgePts[0].y,
        leftEdgePts[leftEdgePts.length - 1].x,
        leftEdgePts[leftEdgePts.length - 1].y
      );
      leftRimGrad.addColorStop(0, 'rgba(226, 232, 240, 0.24)');
      leftRimGrad.addColorStop(0.5, 'rgba(245, 196, 81, 0.16)');
      leftRimGrad.addColorStop(1, 'rgba(245, 196, 81, 0.02)');
      sctx.strokeStyle = leftRimGrad;
      sctx.lineWidth = 1.6;
      sctx.stroke();

      const rightEdgePts = [
        { x: width * 0.575, y: crotchY + 4 },
        { x: width * 0.545, y: trunkMidY },
        ...sculptedRoots[6].pts.slice(1).map(([px, py], i) => ({
          x: px * width + Math.max(8, width * 0.013) * Math.pow(0.76, i),
          y: py * height,
        })),
      ];
      traceSplinePath(rightEdgePts);
      const rightRimGrad = sctx.createLinearGradient(
        rightEdgePts[0].x,
        rightEdgePts[0].y,
        rightEdgePts[rightEdgePts.length - 1].x,
        rightEdgePts[rightEdgePts.length - 1].y
      );
      rightRimGrad.addColorStop(0, 'rgba(226, 232, 240, 0.20)');
      rightRimGrad.addColorStop(0.5, 'rgba(245, 196, 81, 0.13)');
      rightRimGrad.addColorStop(1, 'rgba(245, 196, 81, 0.02)');
      sctx.strokeStyle = rightRimGrad;
      sctx.lineWidth = 1.6;
      sctx.stroke();
      sctx.restore();

      // 4. OS 5 BRAÇOS MESTRES
      const masterBoughs = MASTER_BOUGHS_DEF.map((def) => ({
        pts: def.pts.map(([nx, ny]) => ({ x: nx * width, y: ny * height })),
        wFactor: def.wFactor,
        w1: def.w1,
        phase: def.phase,
        edgeShade: def.edgeShade,
        subForkX: def.subForkX * width,
        subForkY: def.subForkY * height,
      }));

      masterBoughs.forEach((mb, mbIdx) => {
        const startPt = mb.pts[0];
        const endPt = mb.pts[mb.pts.length - 1];
        const baseW = Math.max(16, width * mb.wFactor);

        // Colar de enraizamento: leva a madeira do braço para dentro do tronco,
        // para que a base do galho se funda ao tronco sem estrangulamento.
        const collarRoot = {
          x: startPt.x + (trunkCenterX - startPt.x) * 0.45,
          y: trunkMidY - height * 0.015,
        };
        const collarGrad = sctx.createLinearGradient(
          collarRoot.x,
          collarRoot.y,
          mb.pts[1].x,
          mb.pts[1].y
        );
        collarGrad.addColorStop(0, '#131F3D');
        collarGrad.addColorStop(1, mb.edgeShade ? '#142142' : '#18284E');
        drawTaperedSpline(
          [collarRoot, startPt, mb.pts[1]],
          baseW * 1.1,
          baseW * 0.95,
          collarGrad,
          mb.phase,
          false
        );

        const boughWoodGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        if (mb.edgeShade) {
          boughWoodGrad.addColorStop(0, 'rgba(17, 29, 58, 0.0)');
          boughWoodGrad.addColorStop(0.16, '#142142');
          boughWoodGrad.addColorStop(0.55, '#0E1730');
          boughWoodGrad.addColorStop(1, '#090F20');
        } else {
          boughWoodGrad.addColorStop(0, 'rgba(22, 37, 74, 0.0)');
          boughWoodGrad.addColorStop(0.16, '#18284E');
          boughWoodGrad.addColorStop(0.55, '#0F1933');
          boughWoodGrad.addColorStop(1, '#0A1024');
        }
        drawTaperedSpline(mb.pts, baseW, mb.w1, boughWoodGrad, mb.phase, false, 0.16);

        const hiPts = mb.pts.map((p) => ({ x: p.x, y: p.y - 1.5 }));
        const hiGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        hiGrad.addColorStop(0, 'rgba(245, 196, 81, 0.0)');
        hiGrad.addColorStop(0.20, 'rgba(226, 232, 240, 0.22)');
        hiGrad.addColorStop(1, 'rgba(245, 196, 81, 0.08)');
        drawTaperedSpline(hiPts, baseW * 0.34, 1.2, hiGrad, mb.phase + 0.5, true);

        const forkBase = evalMasterPointFromCache(mbIdx, 0.72);
        const forkPts = [
          forkBase,
          { x: (forkBase.x + endPt.x) * 0.5, y: (forkBase.y + endPt.y) * 0.5 },
          { x: mb.subForkX, y: mb.subForkY },
        ];
        drawTaperedSpline(forkPts, baseW * 0.36, 1.8, '#0E1730', mb.phase + 1.1, true, 0.12);

        sctx.save();
        traceSplinePath(forkPts);
        sctx.strokeStyle = 'rgba(245, 196, 81, 0.45)';
        sctx.lineWidth = 1.4;
        sctx.shadowColor = '#F5C451';
        sctx.shadowBlur = 8;
        sctx.stroke();
        sctx.restore();
      });

      const strandToMasterMap = [0, 1, 2, 2, 2, 3, 4];
      strandToMasterMap.forEach((mbIdx, sIdx) => {
        // Os fios laterais que alimentam o braço central faziam um gancho dourado
        // no topo do tronco; só o fio do meio (sIdx 3) sobe reto até o braço.
        if (mbIdx === 2 && sIdx !== 3) return;
        const mb = masterBoughs[mbIdx];
        const norm = strandNorms[sIdx] ?? 0;
        const waistX =
          trunkCenterX + (norm * 0.82 + Math.sin(sIdx * 1.4) * 0.08) * (width * 0.040);

        const armPts = mb.pts.slice(1);
        const trunkToArmPts = [
          { x: waistX, y: trunkMidY + height * 0.02 },
          { x: trunkCenterX + norm * (width * 0.062), y: crotchY + 6 },
          ...armPts,
        ];
        const startPt = trunkToArmPts[0];
        const endPt = trunkToArmPts[trunkToArmPts.length - 1];

        sctx.save();
        traceSplinePath(trunkToArmPts);
        const armVeinGrad = sctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
        if (mbIdx === 2 && sIdx === 3) {
          armVeinGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
          armVeinGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.78)');
          armVeinGrad.addColorStop(1, 'rgba(245, 196, 81, 0.55)');
        } else {
          armVeinGrad.addColorStop(0, 'rgba(245, 196, 81, 0.16)');
          armVeinGrad.addColorStop(0.35, 'rgba(245, 196, 81, 0.58)');
          armVeinGrad.addColorStop(1, 'rgba(125, 211, 252, 0.34)');
        }
        sctx.strokeStyle = armVeinGrad;
        sctx.lineWidth = mbIdx === 2 && sIdx === 3 ? 2.0 : 1.5;
        sctx.shadowColor = '#F5C451';
        sctx.shadowBlur = 10;
        sctx.stroke();
        sctx.restore();
      });

      sctx.save();
      const leftArmRim = [
        { x: width * 0.455, y: trunkMidY },
        ...masterBoughs[0].pts.slice(1).map((p, i) => ({
          x: p.x,
          y: p.y + Math.max(3, width * 0.008) * Math.pow(0.75, i),
        })),
      ];
      traceSplinePath(leftArmRim);
      const leftArmRimGrad = sctx.createLinearGradient(
        leftArmRim[0].x,
        leftArmRim[0].y,
        leftArmRim[leftArmRim.length - 1].x,
        leftArmRim[leftArmRim.length - 1].y
      );
      leftArmRimGrad.addColorStop(0, 'rgba(226, 232, 240, 0.24)');
      leftArmRimGrad.addColorStop(1, 'rgba(245, 196, 81, 0.04)');
      sctx.strokeStyle = leftArmRimGrad;
      sctx.lineWidth = 1.5;
      sctx.stroke();

      const rightArmRim = [
        { x: width * 0.545, y: trunkMidY },
        ...masterBoughs[4].pts.slice(1).map((p, i) => ({
          x: p.x,
          y: p.y + Math.max(3, width * 0.008) * Math.pow(0.75, i),
        })),
      ];
      traceSplinePath(rightArmRim);
      const rightArmRimGrad = sctx.createLinearGradient(
        rightArmRim[0].x,
        rightArmRim[0].y,
        rightArmRim[rightArmRim.length - 1].x,
        rightArmRim[rightArmRim.length - 1].y
      );
      rightArmRimGrad.addColorStop(0, 'rgba(226, 232, 240, 0.20)');
      rightArmRimGrad.addColorStop(1, 'rgba(245, 196, 81, 0.04)');
      sctx.strokeStyle = rightArmRimGrad;
      sctx.lineWidth = 1.5;
      sctx.stroke();
      sctx.restore();

      // 5. BRAÇOS SECUNDÁRIOS DA COPA
      boughCurvesCache.forEach(({ p0, p1, p2, p3, tb, bIdx }) => {
        const armGrad = sctx.createLinearGradient(p0.x, p0.y, p3.x, p3.y);
        armGrad.addColorStop(0, 'rgba(14, 23, 48, 0.0)');
        armGrad.addColorStop(0.14, '#0E1730');
        armGrad.addColorStop(0.65, '#0B1226');
        armGrad.addColorStop(1, '#070C1A');
        drawTaperedSpline([p0, p1, p2, p3], tb.width * 0.56, 3.2, armGrad, bIdx * 0.7, true);

        sctx.save();
        sctx.beginPath();
        sctx.moveTo(p0.x, p0.y);
        sctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        sctx.strokeStyle =
          bIdx % 3 === 0 ? 'rgba(254, 240, 138, 0.65)' : 'rgba(245, 196, 81, 0.55)';
        sctx.lineWidth = Math.max(1.8, tb.width * 0.14);
        sctx.shadowColor = '#F5C451';
        sctx.shadowBlur = 10;
        sctx.stroke();

        sctx.beginPath();
        sctx.moveTo(p0.x, p0.y);
        sctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        sctx.strokeStyle = 'rgba(248, 246, 240, 0.62)';
        sctx.lineWidth = 0.9;
        sctx.shadowBlur = 0;
        sctx.stroke();
        sctx.restore();
      });

      // 6. TODOS OS GALHOS PERMANENTES (NÃO EM ANIMAÇÃO DE NASCIMENTO)
      branchGeomsCache.forEach((geom) => {
        const id = geom.lp.folha.id;
        if (localBirthAnimRef.current[id]) return;
        drawPrecomputedBranch(
          sctx,
          geom,
          false,
          false,
          newLeafSetRef.current.has(id)
        );
      });

      // 7. VÉU DE NUVEM DOURADA TRANSPARENTE NOS GALHOS (TOM MAIS BAIXO E AVELUDADO)
      sctx.save();
      sctx.globalCompositeOperation = 'screen';
      const goldenCanopyVeil = [
        { cx: 0.50, cy: 0.27, rx: 0.30, ry: 0.16, rot: 0, inner: 'rgba(245, 196, 81, 0.065)', mid: 'rgba(217, 119, 6, 0.025)' },
        { cx: 0.30, cy: 0.30, rx: 0.19, ry: 0.12, rot: -0.14, inner: 'rgba(245, 196, 81, 0.055)', mid: 'rgba(217, 119, 6, 0.02)' },
        { cx: 0.70, cy: 0.30, rx: 0.19, ry: 0.12, rot: 0.14, inner: 'rgba(245, 196, 81, 0.055)', mid: 'rgba(217, 119, 6, 0.02)' },
        { cx: 0.50, cy: 0.17, rx: 0.21, ry: 0.10, rot: 0, inner: 'rgba(254, 240, 138, 0.045)', mid: 'rgba(245, 196, 81, 0.015)' },
      ];
      goldenCanopyVeil.forEach((gv) => {
        drawAuroraGlow(
          width * gv.cx,
          height * gv.cy,
          width * gv.rx,
          height * gv.ry,
          gv.rot,
          gv.inner,
          gv.mid
        );
      });
      sctx.restore();

      pendingFlushIds.clear();
      staticDirtyRef.current = false;
      lastStaticRebuildPerf = performance.now();
    };

    const stampGlow = (color: string, x: number, y: number, radius: number, alpha = 1) => {
      const sprite = getGlowSprite(color);
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    };

    let animId: number;
    let time = 0;
    let lastPerf = performance.now();

    const render = () => {
      const nowPerf = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowPerf - lastPerf) / 1000));
      lastPerf = nowPerf;
      time += dt;
      const dtScale = dt * 60;

      // Reconstrói o canvas estático apenas quando necessário (com throttle durante cascatas em lote)
      const activeBirthCount = Object.keys(localBirthAnimRef.current).length;
      if (
        geomDirtyRef.current ||
        (staticDirtyRef.current &&
          (activeBirthCount === 0 || nowPerf - lastStaticRebuildPerf > 380))
      ) {
        rebuildStaticScene();
      }

      // 1. BLIT INSTANTÂNEO DA ÁRVORE ESTÁTICA E DO CÉU (~0.1ms)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticCanvas, 0, 0);
      ctx.restore();
      ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

      // 2. ESTRELAS CINTILANTES E PÓLEN DO DOSSEL (ZERO shadowBlur)
      ctx.save();
      stars.forEach((st) => {
        const alpha = st.baseAlpha + Math.sin(time * st.twinkleSpeed + st.twinklePhase) * 0.25;
        const clampedAlpha = Math.max(0.1, Math.min(1, alpha));
        const sx = st.nx * width;
        const sy = st.ny * height;
        if (st.size > 1.55) {
          stampGlow(st.color, sx, sy, st.size * 3.4, clampedAlpha * 0.65);
        }
        ctx.globalAlpha = clampedAlpha;
        ctx.fillStyle = st.color;
        ctx.fillRect(sx - st.size * 0.5, sy - st.size * 0.5, st.size, st.size);
      });

      ctx.globalCompositeOperation = 'lighter';
      pollenParticles.forEach((pl) => {
        const px = pl.nx * width + Math.sin(time * 0.9 + pl.phase) * 5;
        const py = pl.ny * height + Math.cos(time * 0.7 + pl.phase) * 4;
        const pAlpha = Math.max(0.12, 0.42 + Math.sin(time * 2 + pl.phase) * 0.28);
        stampGlow('#F5C451', px, py, pl.radius * 3.4, pAlpha);
      });
      ctx.restore();

      const trunkCenterX = width * 0.5;
      const trunkBaseX = trunkCenterX;
      const trunkMidY = height * 0.66;
      const crotchY = height * 0.535;
      const rootMergeY = height * 0.80;
      const trunkTopX = trunkCenterX;
      const trunkTopY = height * 0.40;

      // 3. DESTAQUE DE GALHO SELECIONADO / HOVERED + GALHOS PENDENTES / EM NASCIMENTO
      const ANIM_TOTAL_MS = 2650;
      const curSelected = selectedFolhaRef.current;
      const curHovered = hoveredFolhaRef.current;

      // Desenha galhos que acabaram a animação enquanto aguardam o próximo flush no canvas estático
      pendingFlushIds.forEach((id) => {
        const geom = branchGeomById.get(id);
        if (geom) {
          drawPrecomputedBranch(
            ctx,
            geom,
            curSelected?.id === id,
            curHovered?.id === id,
            newLeafSetRef.current.has(id)
          );
        }
      });

      // Destaque sob demanda apenas para o galho hovered ou selecionado (O(1))
      if (curHovered && !localBirthAnimRef.current[curHovered.id] && !pendingFlushIds.has(curHovered.id)) {
        const geom = branchGeomById.get(curHovered.id);
        if (geom) {
          drawPrecomputedBranch(ctx, geom, curSelected?.id === curHovered.id, true, newLeafSetRef.current.has(curHovered.id));
        }
      }
      if (curSelected && !localBirthAnimRef.current[curSelected.id]) {
        const geom = branchGeomById.get(curSelected.id);
        if (geom) {
          if (!pendingFlushIds.has(curSelected.id)) {
            drawPrecomputedBranch(ctx, geom, true, curHovered?.id === curSelected.id, newLeafSetRef.current.has(curSelected.id));
          }
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(trunkBaseX, trunkMidY);
          ctx.bezierCurveTo(
            trunkTopX,
            trunkTopY,
            geom.anchorPt.x,
            geom.anchorPt.y,
            geom.leafPt.x,
            geom.leafPt.y
          );
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.80)';
          ctx.lineWidth = 2.0;
          ctx.shadowColor = '#FEF08A';
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.restore();
        }
      }

      // 4. ANIMAÇÃO ESPECIAL DE NASCIMENTO (SOMENTE FOLHAS ATUALMENTE ANIMANDO)
      const birthEntries = Object.entries(localBirthAnimRef.current);
      if (birthEntries.length > 0) {
        const finishedIds: string[] = [];
        const ringsToDraw: { x: number; y: number; r: number; a: number; color: string }[] = [];

        ctx.save();
        birthEntries.forEach(([id, animInfo]) => {
          const geom = branchGeomById.get(id);
          if (!geom) {
            finishedIds.push(id);
            return;
          }
          const elapsed = nowPerf - animInfo.startAt - animInfo.delay;
          if (elapsed < 0) return;

          if (elapsed >= ANIM_TOTAL_MS) {
            finishedIds.push(id);
            return;
          }

          const p = elapsed / ANIM_TOTAL_MS;
          const lp = geom.lp;
          const isMasterHost = lp.hostType === 'master';
          const bc = isMasterHost ? null : boughCurvesCache[lp.branchIdx] || boughCurvesCache[0];

          if (p <= 0.42) {
            const waveP = Math.min(1, p / 0.38);
            let wavePt: { x: number; y: number };
            if (isMasterHost) {
              if (waveP < 0.44) {
                const tt = waveP / 0.44;
                wavePt = {
                  x: trunkCenterX + Math.sin(tt * Math.PI * 2) * 3,
                  y: rootMergeY - (rootMergeY - crotchY) * tt,
                };
              } else {
                const tt = ((waveP - 0.44) / 0.56) * lp.anchorT;
                wavePt = evalMasterPointFromCache(lp.branchIdx, tt);
              }
            } else {
              if (waveP < 0.38) {
                const tt = waveP / 0.38;
                wavePt = {
                  x: trunkCenterX + Math.sin(tt * Math.PI * 2) * 3,
                  y: rootMergeY - (rootMergeY - crotchY) * tt,
                };
              } else if (waveP < 0.68) {
                const tt = ((waveP - 0.38) / 0.30) * bc!.tb.attachT;
                wavePt = evalMasterPointFromCache(bc!.tb.masterIdx, tt);
              } else {
                const tt = ((waveP - 0.68) / 0.32) * lp.anchorT;
                wavePt = evalCubic(bc!.p0, bc!.p1, bc!.p2, bc!.p3, tt);
              }
            }

            ctx.globalCompositeOperation = 'lighter';
            stampGlow(lp.folha.cor, wavePt.x, wavePt.y, 16, 0.85);
            ctx.globalCompositeOperation = 'source-over';
          }

          if (p >= 0.33) {
            const growT = easeOutCubic((p - 0.33) / 0.39);
            const fullSampled = geom.sampled;
            const endIdx = Math.max(2, Math.ceil(growT * (fullSampled.length - 1)) + 1);
            const growingPts = fullSampled.slice(0, endIdx);
            drawGrowingBranch(
              ctx,
              growingPts,
              geom.baseW,
              lp.grainPhase,
              growT < 0.98 ? 0.65 : 1
            );

            if (growT < 0.99) {
              const tip = growingPts[growingPts.length - 1];
              ctx.globalCompositeOperation = 'lighter';
              stampGlow(lp.folha.cor, tip.x, tip.y, 13, 0.95);
              ctx.globalCompositeOperation = 'source-over';
            }
          }

          if (p >= 0.66) {
            const bloomT = (p - 0.66) / 0.34;
            ringsToDraw.push({
              x: geom.leafPt.x,
              y: geom.leafPt.y,
              r: 6 + bloomT * 26,
              a: Math.max(0, 1 - bloomT) * 0.85,
              color: lp.folha.cor,
            });
          }
        });

        ringsToDraw.forEach((rg) => {
          ctx.globalAlpha = rg.a;
          ctx.strokeStyle = rg.color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();

        if (finishedIds.length > 0) {
          finishedIds.forEach((id) => {
            delete localBirthAnimRef.current[id];
            pendingFlushIds.add(id);
          });
          staticDirtyRef.current = true;
        }
      }

      // 5. PULSOS DO TRONCO, PULSOS DOS BRAÇOS E CENTELHAS CÓSMICAS (SPRITES ADITIVOS A 60 FPS)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      trunkWirePulses.forEach((p) => {
        p.progress += p.speed * dtScale;
        if (p.progress >= 1) {
          p.progress -= 1;
          p.strandIdx = Math.floor(Math.random() * 20);
        }

        const t = p.progress;
        const py = rootMergeY - (rootMergeY - crotchY) * t;
        const currentTrunkWidth =
          t < 0.45
            ? width * 0.125 * (1 - t / 0.45) + width * 0.085 * (t / 0.45)
            : width * 0.085 * (1 - (t - 0.45) / 0.55) + width * 0.135 * ((t - 0.45) / 0.55);

        const strandNorm = (p.strandIdx - 10) / 10;
        const px =
          trunkCenterX +
          strandNorm * (currentTrunkWidth * 0.36) +
          Math.sin(t * Math.PI * 2.2 + p.strandIdx + time) * 2.5;

        stampGlow(p.color, px, py, p.size * 3.8, 0.92);
      });

      temporalPulses.forEach((pulse) => {
        pulse.progress += pulse.speed * dtScale;
        if (pulse.progress >= 1) {
          pulse.progress -= 1;
          pulse.boughIdx = Math.floor(Math.random() * boughCurvesCache.length);
        }

        const bc = boughCurvesCache[pulse.boughIdx] || boughCurvesCache[0];
        if (!bc) return;
        const pt = evalMasterSample(bc.samples, pulse.progress);
        stampGlow(pulse.color, pt.x, pt.y, pulse.size * 3.8, 0.95);
      });

      cosmicSparks.forEach((sp) => {
        sp.nx += (sp.vx + Math.sin(time + sp.ny * 12) * 0.0002) * dtScale;
        sp.ny += sp.vy * dtScale;

        if (sp.ny < -0.02) {
          sp.ny = 1.02;
          sp.nx = Math.random();
        }
        if (sp.nx < 0) sp.nx = 1;
        if (sp.nx > 1) sp.nx = 0;

        stampGlow(sp.color, sp.nx * width, sp.ny * height, sp.size * 3.6, sp.alpha);
      });

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const evalMasterSample = (samples: { x: number; y: number }[], t: number) => {
      const fIdx = Math.max(0, Math.min(1, t)) * (samples.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(samples.length - 1, i0 + 1);
      const frac = fIdx - i0;
      return {
        x: samples[i0].x + (samples[i1].x - samples[i0].x) * frac,
        y: samples[i0].y + (samples[i1].y - samples[i0].y) * frac,
      };
    };

    rebuildStaticScene();
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', syncCanvasSize);
      resizeObserver?.disconnect();
      cancelAnimationFrame(animId);
    };
  }, [timelineBoughs]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current
          .requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement) {
        document
          .exitFullscreen()
          .then(() => setIsFullscreen(false))
          .catch(() => setIsFullscreen(false));
      } else {
        setIsFullscreen(false);
      }
    }
  };

  const filteredLeaves = useMemo(() => {
    return leafPlacements.filter((lp) => {
      const matchSearch =
        searchTerm === '' ||
        lp.folha.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lp.folha.profissao.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        selectedCategory === 'all' ||
        lp.folha.profissao.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [leafPlacements, searchTerm, selectedCategory]);

  const handleHoverStart = useCallback(
    (folha: Folha) => {
      setHoveredFolha(folha);
      playCosmicChime(659);
    },
    [playCosmicChime]
  );

  const handleHoverEnd = useCallback(() => {
    setHoveredFolha(null);
  }, []);

  const handleSelectLeaf = useCallback(
    (folha: Folha) => {
      onSelectFolha(folha);
      playCosmicChime(587);
    },
    [onSelectFolha, playCosmicChime]
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none bg-[#070B19] flex flex-col justify-between transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : 'w-full rounded-3xl border border-[#1E2949] shadow-2xl min-h-[660px] h-[78vh]'
      }`}
    >
      {/* 1. Canvas Central Cósmico: Vazio do Fim dos Tempos, Tronco de Fios Trançados e Galhos de Yggdrasil */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* 2. Camada Interativa das Folhas Botânicas Orgânicas */}
      <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto">
        {filteredLeaves.map((lp) => {
          const leafW = 28 * lp.scale * leafSizeMultiplier;
          const leafH = 39 * lp.scale * leafSizeMultiplier;

          return (
            <LeafCanopyItem
              key={lp.id}
              lp={lp}
              isSelected={selectedFolha?.id === lp.folha.id}
              isHovered={hoveredFolha?.id === lp.folha.id}
              bloomDelay={bloomDelays[lp.folha.id]}
              leafW={leafW}
              leafH={leafH}
              onHoverStart={handleHoverStart}
              onHoverEnd={handleHoverEnd}
              onSelect={handleSelectLeaf}
            />
          );
        })}
      </div>

      {/* 3. Barra Superior HUD do Telão Cósmico de Yggdrasil */}
      <div className="relative z-30 p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 pointer-events-auto bg-gradient-to-b from-[#070B19]/95 via-[#070B19]/70 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-[#0E152B]/90 border border-[#F5C451]/35 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur">
            <TreeDeciduous className="w-4 h-4 text-[#F5C451]" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black tracking-wider bg-gradient-to-r from-[#F8F6F0] via-[#F5C451] to-[#D97706] bg-clip-text text-transparent">
                ÁRVORE ANCESTRAL • TRONCO ESCULPIDO
              </span>
              <span className="text-[9px] text-[#94A3C8] font-mono">
                Raízes Tabulares, Contrafortes &amp; Copa Astral
              </span>
            </div>
            <span className="text-[#2C3C6B]">•</span>
            <span className="text-xs text-[#CBD5E1]">
              <strong className="text-[#F8F6F0] font-mono tabular-nums">{folhas.length}</strong> folhas vivas
            </span>
          </div>

          <div className="hidden md:flex items-center bg-[#0E152B]/90 border border-[#1E2949] rounded-xl px-2.5 py-1 text-xs text-[#CBD5E1] focus-within:border-[#F5C451]">
            <Search className="w-3.5 h-3.5 text-[#94A3C8] mr-1.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar aluno ou destino..."
              className="bg-transparent focus:outline-none text-xs text-[#F8F6F0] placeholder-[#64748B] w-36"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-[#94A3C8] hover:text-[#F8F6F0] ml-1 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {categories.length > 1 && (
            <div className="hidden lg:flex items-center gap-1">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-[#F5C451] text-[#070B19] font-bold shadow-sm'
                      : 'bg-[#0E152B]/85 text-[#94A3C8] hover:text-[#F8F6F0] border border-[#1E2949]'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 bg-[#0E152B]/85 border border-[#1E2949] px-2.5 py-1 rounded-xl text-[11px] text-[#94A3C8]">
            <Sliders className="w-3.5 h-3.5 text-[#94A3C8]" />
            <span>Escala:</span>
            <button
              onClick={() => setLeafSizeMultiplier((m) => Math.max(0.7, m - 0.15))}
              className="px-1.5 py-0.5 hover:text-[#F8F6F0] font-bold"
              title="Reduzir tamanho das folhas"
            >
              -
            </button>
            <span className="font-mono tabular-nums text-[#F5C451] text-xs">
              {Math.round(leafSizeMultiplier * 100)}%
            </span>
            <button
              onClick={() => setLeafSizeMultiplier((m) => Math.min(1.6, m + 0.15))}
              className="px-1.5 py-0.5 hover:text-[#F8F6F0] font-bold"
              title="Aumentar tamanho das folhas"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl text-xs font-semibold transition border shadow-md ${
              audioEnabled
                ? 'bg-[#F5C451]/15 text-[#F5C451] border-[#F5C451]/50'
                : 'bg-[#0E152B]/85 text-[#94A3C8] hover:text-[#F8F6F0] border-[#1E2949]'
            }`}
            title={audioEnabled ? 'Desativar Sons Cósmicos' : 'Ativar Efeitos Cósmicos'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-[#F5C451]" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setAutoTourActive(!autoTourActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border shadow-md ${
              autoTourActive
                ? 'bg-[#D97706]/20 text-[#FDE68A] border-[#F5C451]/50'
                : 'bg-[#0E152B]/85 text-[#CBD5E1] hover:text-[#F8F6F0] border-[#1E2949]'
            }`}
            title="Percorre suavemente os sonhos dos alunos no telão"
          >
            {autoTourActive ? (
              <>
                <Pause className="w-3.5 h-3.5 text-[#F5C451]" />
                <span>Pausar Tour</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#F5C451]" />
                <span>Tour Cósmico</span>
              </>
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-[#0E152B]/85 hover:bg-[#162040] text-[#CBD5E1] hover:text-[#F8F6F0] rounded-xl border border-[#1E2949] transition shadow-md"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia do Telão'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* 4. Cartão Holográfico Detalhado da Linha Temporal Selecionada */}
      {selectedFolha && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-full bg-[#070B19]/95 border-2 rounded-3xl p-5 shadow-[0_0_50px_rgba(2,4,10,0.92)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ borderColor: selectedFolha.cor }}
        >
          <button
            onClick={onClearSelection}
            className="absolute top-4 right-4 text-[#94A3C8] hover:text-[#F8F6F0] p-1 rounded-full hover:bg-[#131C38] text-sm"
          >
            ✕
          </button>

          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 relative overflow-hidden"
              style={{
                backgroundColor: `${selectedFolha.cor}25`,
                boxShadow: `0 0 25px ${selectedFolha.cor}60`,
                border: `1px solid ${selectedFolha.cor}80`,
              }}
            >
              <BotanicalLeaf
                id={selectedFolha.id}
                color={selectedFolha.cor}
                width={36}
                height={50}
                isSelected
                uidSuffix="card"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-[#F8F6F0] truncate">
                  {selectedFolha.nome}
                </h3>
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: `${selectedFolha.cor}25`,
                    color: selectedFolha.cor,
                    border: `1px solid ${selectedFolha.cor}60`,
                  }}
                >
                  <Sparkles className="w-2.5 h-2.5 inline" />
                  Linha Temporal Sagrada
                </span>
              </div>
              <p className="text-sm font-bold text-[#F5C451]">
                {selectedFolha.profissao}
              </p>

              {selectedFolha.mensagem && (
                <p className="text-xs text-[#CBD5E1] italic pt-1 border-t border-[#1E2949]">
                  "{selectedFolha.mensagem}"
                </p>
              )}
            </div>
          </div>

          {selectedFolha.assinatura && (
            <div className="mt-3 pt-3 border-t border-[#1E2949] flex items-center justify-between gap-4">
              <div className="text-[10px] text-[#94A3C8] uppercase font-mono">
                Assinatura Autêntica Registrada
              </div>
              <div className="h-12 max-w-[200px] flex items-center justify-end bg-[#0E152B] px-3 rounded-xl border border-[#1E2949]">
                <img
                  src={selectedFolha.assinatura}
                  alt={`Assinatura de ${selectedFolha.nome}`}
                  className="max-h-10 object-contain"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Rodapé Minimalista */}
      <div className="relative z-30 pb-3 text-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#070B19]/85 border border-[#1E2949] text-[10px] text-[#94A3C8] backdrop-blur">
          <Sparkles className="w-3 h-3 text-[#F5C451]" />
          <span>Árvore Ancestral • Noite Astral &amp; Ouro</span>
        </div>
      </div>
    </div>
  );
}
