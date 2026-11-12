import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Folha } from '../App.tsx';
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
}

interface LeafPlacement {
  id: string;
  folha: Folha;
  x: number; // Porcentagem (0-100)
  y: number; // Porcentagem (0-100)
  angle: number; // Rotação em graus
  scale: number;
  swayDelay: number;
  branchIdx: number;
  branchTargetX: number;
  branchTargetY: number;
}

export function NeuralTree({
  folhas,
  selectedFolha,
  onSelectFolha,
  onClearSelection,
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

  // Audio Context Ref (Web Audio API para som cósmico sutil no telão)
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Tocar sino cósmico sutil ao focar em uma folha temporal
  const playCosmicChime = (freq = 528) => {
    if (!audioEnabled) return;
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
  };

  // Categorias de profissões únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    folhas.forEach((f) => {
      if (f.profissao) set.add(f.profissao.trim());
    });
    return ['all', ...Array.from(set).slice(0, 6)];
  }, [folhas]);

  // Estrutura das 12 Principais Bacias Temporais de Yggdrasil conectadas organicamente à copa da acácia ancestral
  const timelineBoughs = useMemo(() => {
    return [
      // 1. Galho Inferior Esquerdo (Cotovelo lateral que abre para o extremo esquerdo)
      { id: 'tb_left_outer_low', startX: 0.44, startY: 0.54, cp1X: 0.32, cp1Y: 0.54, cp2X: 0.20, cp2Y: 0.50, endX: 0.12, endY: 0.44, width: 28, angle: -65 },
      // 2. Galho Esquerdo Médio-Baixo
      { id: 'tb_left_mid_low',   startX: 0.44, startY: 0.54, cp1X: 0.34, cp1Y: 0.50, cp2X: 0.25, cp2Y: 0.42, endX: 0.18, endY: 0.35, width: 26, angle: -48 },
      // 3. Galho Esquerdo Médio
      { id: 'tb_left_mid',       startX: 0.44, startY: 0.54, cp1X: 0.36, cp1Y: 0.46, cp2X: 0.28, cp2Y: 0.35, endX: 0.24, endY: 0.26, width: 24, angle: -35 },
      // 4. Galho Esquerdo Alto
      { id: 'tb_left_high',      startX: 0.48, startY: 0.52, cp1X: 0.42, cp1Y: 0.42, cp2X: 0.35, cp2Y: 0.28, endX: 0.32, endY: 0.18, width: 22, angle: -24 },
      // 5. Ápice Esquerdo da Coroa
      { id: 'tb_apex_left',      startX: 0.48, startY: 0.52, cp1X: 0.45, cp1Y: 0.38, cp2X: 0.40, cp2Y: 0.22, endX: 0.42, endY: 0.10, width: 22, angle: -10 },
      // 6. Corredor Interior Esquerdo
      { id: 'tb_center_inner',   startX: 0.49, startY: 0.52, cp1X: 0.48, cp1Y: 0.40, cp2X: 0.46, cp2Y: 0.28, endX: 0.48, endY: 0.22, width: 20, angle: -4 },
      // 7. Corredor Interior Direito
      { id: 'tb_apex_center',    startX: 0.51, startY: 0.52, cp1X: 0.52, cp1Y: 0.40, cp2X: 0.54, cp2Y: 0.28, endX: 0.52, endY: 0.22, width: 20, angle: 4 },
      // 8. Ápice Direito da Coroa
      { id: 'tb_apex_right',     startX: 0.52, startY: 0.52, cp1X: 0.55, cp1Y: 0.38, cp2X: 0.60, cp2Y: 0.22, endX: 0.58, endY: 0.10, width: 22, angle: 10 },
      // 9. Galho Direito Alto
      { id: 'tb_right_high',     startX: 0.52, startY: 0.52, cp1X: 0.58, cp1Y: 0.42, cp2X: 0.65, cp2Y: 0.28, endX: 0.68, endY: 0.18, width: 22, angle: 24 },
      // 10. Galho Direito Médio
      { id: 'tb_right_mid',      startX: 0.56, startY: 0.54, cp1X: 0.64, cp1Y: 0.46, cp2X: 0.72, cp2Y: 0.35, endX: 0.76, endY: 0.26, width: 24, angle: 35 },
      // 11. Galho Direito Médio-Baixo
      { id: 'tb_right_mid_low',  startX: 0.56, startY: 0.54, cp1X: 0.66, cp1Y: 0.50, cp2X: 0.75, cp2Y: 0.42, endX: 0.82, endY: 0.35, width: 26, angle: 48 },
      // 12. Galho Inferior Direito (Cotovelo lateral que abre para o extremo direito)
      { id: 'tb_right_outer_low',startX: 0.56, startY: 0.54, cp1X: 0.68, cp1Y: 0.54, cp2X: 0.80, cp2Y: 0.50, endX: 0.88, endY: 0.44, width: 28, angle: 65 },
    ];
  }, []);

  // Mapeamento elegante e espaçado de 100+ folhas reais ao redor da copa cósmica de Yggdrasil
  const leafPlacements = useMemo(() => {
    const list: LeafPlacement[] = [];

    folhas.forEach((folha, idx) => {
      const branchIdx = idx % timelineBoughs.length;
      const bough = timelineBoughs[branchIdx];

      // Dispersão com espiral áurea ao longo do arco terminal do galho
      const phi = (idx * 137.5) * (Math.PI / 180);
      const ring = (idx % 12) / 12;
      const r = Math.pow(ring, 0.7);

      const spreadRadiusX = 0.082;
      const spreadRadiusY = 0.062;

      const offsetX = Math.cos(phi) * spreadRadiusX * r;
      const offsetY = Math.sin(phi) * spreadRadiusY * r;

      // Mantém as folhas estritamente no dossel cósmico acima e ao redor dos galhos
      const x = Math.max(0.07, Math.min(0.93, bough.endX + offsetX));
      const y = Math.max(0.05, Math.min(0.53, bough.endY + offsetY));

      // Ângulo natural apontando na direção do fluxo da linha temporal
      const angleVariation = ((idx * 23) % 30) - 15;
      const angle = bough.angle + angleVariation;

      const scale = 0.95 + ((idx * 7) % 6) * 0.07;
      const swayDelay = ((idx * 0.4) % 4);

      list.push({
        id: folha.id,
        folha,
        x: x * 100,
        y: y * 100,
        angle,
        scale,
        swayDelay,
        branchIdx,
        branchTargetX: bough.endX,
        branchTargetY: bough.endY,
      });
    });

    return list;
  }, [folhas, timelineBoughs]);

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

  // RENDERIZAÇÃO GRÁFICA NO CANVAS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 1200);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 700);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Estrelas e nós de universos distantes no vazio cósmico
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 0.6 + Math.random() * 1.8,
      baseAlpha: 0.2 + Math.random() * 0.7,
      twinkleSpeed: 0.02 + Math.random() * 0.04,
      twinklePhase: Math.random() * Math.PI * 2,
      color: ['#FFFFFF', '#A7F3D0', '#67E8F9', '#FEF08A'][Math.floor(Math.random() * 4)],
    }));

    // Pulsos de energia temporal ("Nexus Surges")
    const temporalPulses = Array.from({ length: 24 }, () => ({
      boughIdx: Math.floor(Math.random() * timelineBoughs.length),
      progress: Math.random(),
      speed: 0.0035 + Math.random() * 0.005,
      size: 2.2 + Math.random() * 2.8,
      color: ['#00FF87', '#60EFFF', '#FEF08A', '#34D399', '#38BDF8'][Math.floor(Math.random() * 5)],
    }));

    // Pulsos de energia viajando pelos fios trançados do tronco
    const trunkWirePulses = Array.from({ length: 16 }, () => ({
      strandIdx: Math.floor(Math.random() * 28),
      progress: Math.random(),
      speed: 0.004 + Math.random() * 0.006,
      size: 2.0 + Math.random() * 2.5,
      color: ['#00FF87', '#FEF08A', '#38BDF8', '#60EFFF', '#34D399'][Math.floor(Math.random() * 5)],
    }));

    // Poeira estelar / centelhas temporais flutuando no espaço
    const cosmicSparks = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.25 - Math.random() * 0.5,
      size: 1.2 + Math.random() * 2.2,
      alpha: 0.2 + Math.random() * 0.6,
      color: ['#00FF87', '#34D399', '#38BDF8', '#FEF08A', '#F59E0B'][Math.floor(Math.random() * 5)],
    }));

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // =========================================================================
      // 1. ESPAÇO CÓSMICO E NEBULOSAS DO FIM DOS TEMPOS
      // =========================================================================
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.58,
        width * 0.04,
        width * 0.5,
        height * 0.52,
        width * 0.8
      );
      bgGrad.addColorStop(0, '#021816');
      bgGrad.addColorStop(0.25, '#021019');
      bgGrad.addColorStop(0.55, '#010912');
      bgGrad.addColorStop(0.85, '#010408');
      bgGrad.addColorStop(1, '#000204');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Estrelas cintilantes do multiverso
      stars.forEach((st) => {
        const alpha = st.baseAlpha + Math.sin(time * 3 + st.twinklePhase) * 0.25;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
        ctx.fillStyle = st.color;
        ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Auroras cósmicas boreais em anéis e nuvens de energia temporal
      const drawAuroraGlow = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        rot: number,
        colorStart: string,
        colorMid: string
      ) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        grad.addColorStop(0, colorStart);
        grad.addColorStop(0.55, colorMid);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      };

      const breathe = Math.sin(time * 1.5) * 0.05;
      drawAuroraGlow(
        width * 0.5,
        height * 0.28,
        width * 0.42 * (1 + breathe),
        height * 0.32,
        0,
        'rgba(0, 255, 135, 0.22)',
        'rgba(16, 185, 129, 0.08)'
      );
      drawAuroraGlow(
        width * 0.32,
        height * 0.22,
        width * 0.28,
        height * 0.25,
        -0.2,
        'rgba(56, 189, 248, 0.18)',
        'rgba(14, 165, 233, 0.05)'
      );
      drawAuroraGlow(
        width * 0.68,
        height * 0.22,
        width * 0.28,
        height * 0.25,
        0.2,
        'rgba(6, 182, 212, 0.18)',
        'rgba(14, 165, 233, 0.05)'
      );
      drawAuroraGlow(
        width * 0.5,
        height * 0.62,
        width * 0.26,
        height * 0.18,
        0,
        'rgba(254, 240, 138, 0.22)',
        'rgba(245, 158, 11, 0.06)'
      );

      // =========================================================================
      // 2. DOSSEL DE FOLHAGEM ORGÂNICA DA COPA (UMBRELLA CANOPY - ACÁCIA / BAOBÁ)
      // =========================================================================
      // Nuvens densas e suaves de folhagem em múltiplos planos que dão volume e vida real à copa
      const foliageClusters = [
        // Núcleo central profundo da copa
        { cx: 0.50, cy: 0.22, rx: 0.28, ry: 0.16, alpha: 0.55, color: '#01281e' },
        { cx: 0.50, cy: 0.19, rx: 0.24, ry: 0.14, alpha: 0.65, color: '#023d2e' },
        { cx: 0.50, cy: 0.16, rx: 0.19, ry: 0.11, alpha: 0.50, color: '#035c45' },
        // Ala esquerda do dossel (estilo guarda-chuva de acácia)
        { cx: 0.32, cy: 0.28, rx: 0.20, ry: 0.15, alpha: 0.50, color: '#01261d' },
        { cx: 0.24, cy: 0.35, rx: 0.17, ry: 0.13, alpha: 0.45, color: '#023829' },
        { cx: 0.16, cy: 0.42, rx: 0.14, ry: 0.10, alpha: 0.40, color: '#022e22' },
        { cx: 0.36, cy: 0.19, rx: 0.17, ry: 0.12, alpha: 0.55, color: '#034f3a' },
        { cx: 0.27, cy: 0.24, rx: 0.16, ry: 0.12, alpha: 0.50, color: '#04644a' },
        // Ala direita do dossel
        { cx: 0.68, cy: 0.28, rx: 0.20, ry: 0.15, alpha: 0.50, color: '#01261d' },
        { cx: 0.76, cy: 0.35, rx: 0.17, ry: 0.13, alpha: 0.45, color: '#023829' },
        { cx: 0.84, cy: 0.42, rx: 0.14, ry: 0.10, alpha: 0.40, color: '#022e22' },
        { cx: 0.64, cy: 0.19, rx: 0.17, ry: 0.12, alpha: 0.55, color: '#034f3a' },
        { cx: 0.73, cy: 0.24, rx: 0.16, ry: 0.12, alpha: 0.50, color: '#04644a' },
        // Cúpula superior e ápice
        { cx: 0.43, cy: 0.12, rx: 0.15, ry: 0.08, alpha: 0.55, color: '#057355' },
        { cx: 0.57, cy: 0.12, rx: 0.15, ry: 0.08, alpha: 0.55, color: '#057355' },
        { cx: 0.50, cy: 0.09, rx: 0.14, ry: 0.06, alpha: 0.60, color: '#068865' },
        { cx: 0.50, cy: 0.07, rx: 0.10, ry: 0.05, alpha: 0.45, color: '#0aa178' },
      ];

      foliageClusters.forEach((fc) => {
        const cx = fc.cx * width;
        const cy = fc.cy * height;
        const rx = fc.rx * width;
        const ry = fc.ry * height;
        const grad = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
        grad.addColorStop(0, fc.color);
        grad.addColorStop(0.7, fc.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = fc.alpha;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Pequenas partículas de pólen bioluminescente flutuando no dossel
      for (let p = 0; p < 18; p++) {
        const px = width * (0.15 + (p * 0.041) % 0.7);
        const py = height * (0.08 + (p * 0.023) % 0.4);
        const pRad = 1.2 + (p % 3) * 0.8;
        const pAlpha = 0.3 + Math.sin(time * 2 + p) * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, pRad, 0, Math.PI * 2);
        ctx.fillStyle = '#FEF08A';
        ctx.globalAlpha = Math.max(0.05, pAlpha);
        ctx.shadowColor = '#00FF87';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // =========================================================================
      // 3. TRONCO ESCULPIDO REAL (FIEL À IMAGEM DA ÁRVORE ANCESTRAL / BAOBÁ)
      // =========================================================================
      const trunkCenterX = width * 0.5;
      const trunkBaseX = trunkCenterX;
      const abyssRootY = height * 1.24;    // Raízes descem para além do visor no vão cósmico
      const rootBaseY = height * 0.74;     // Base onde as raízes tabulares se espalham
      const trunkMidY = height * 0.62;     // Cintura esculpida do tronco
      const crotchY = height * 0.52;       // Forquilha mestre onde nascem os 5 grandes galhos
      const trunkTopX = trunkCenterX;
      const trunkTopY = height * 0.38;

      // A) Névoa suave de luz cósmica esmeralda no abismo sob a árvore
      const voidGlow = ctx.createRadialGradient(
        trunkCenterX,
        height * 0.82,
        width * 0.05,
        trunkCenterX,
        height * 0.88,
        width * 0.45
      );
      voidGlow.addColorStop(0, 'rgba(0, 255, 135, 0.20)');
      voidGlow.addColorStop(0.45, 'rgba(16, 185, 129, 0.10)');
      voidGlow.addColorStop(0.8, 'rgba(6, 182, 212, 0.04)');
      voidGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = voidGlow;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);

      // B) Silhueta Volumétrica Contínua do Tronco Esculpido (Madeira Viva Orgânica)
      ctx.beginPath();
      // Inicia na raiz esquerda que mergulha no abismo
      ctx.moveTo(width * 0.24, abyssRootY);
      // Contraforte tabular esquerdo subindo
      ctx.bezierCurveTo(
        width * 0.32,
        height * 0.86,
        width * 0.36,
        rootBaseY,
        width * 0.40,
        trunkMidY
      );
      // Cintura esquerda até a forquilha
      ctx.bezierCurveTo(
        width * 0.41,
        crotchY + (trunkMidY - crotchY) * 0.4,
        width * 0.38,
        crotchY + 10,
        width * 0.36,
        crotchY
      );
      // Forquilha mestre (cume ondulado orgânico de madeira de onde partem os galhos)
      ctx.bezierCurveTo(
        width * 0.43,
        crotchY - 14,
        width * 0.47,
        crotchY - 8,
        trunkCenterX,
        crotchY - 16
      );
      ctx.bezierCurveTo(
        width * 0.53,
        crotchY - 8,
        width * 0.57,
        crotchY - 14,
        width * 0.64,
        crotchY
      );
      // Ombro direito até a cintura
      ctx.bezierCurveTo(
        width * 0.62,
        crotchY + 10,
        width * 0.59,
        crotchY + (trunkMidY - crotchY) * 0.4,
        width * 0.60,
        trunkMidY
      );
      // Cintura direita descendo até o contraforte tabular direito no abismo
      ctx.bezierCurveTo(
        width * 0.64,
        rootBaseY,
        width * 0.68,
        height * 0.86,
        width * 0.76,
        abyssRootY
      );
      ctx.closePath();

      // Gradiente de madeira nobre esmeralda e jade profundo
      const trunkGrad = ctx.createLinearGradient(
        trunkCenterX,
        abyssRootY,
        trunkCenterX,
        crotchY - 20
      );
      trunkGrad.addColorStop(0, '#01150f');
      trunkGrad.addColorStop(0.25, '#022c20');
      trunkGrad.addColorStop(0.55, '#034734');
      trunkGrad.addColorStop(0.85, '#056349');
      trunkGrad.addColorStop(1, '#077a5b');
      ctx.fillStyle = trunkGrad;
      ctx.shadowColor = '#00FF87';
      ctx.shadowBlur = 28;
      ctx.fill();

      // C) Raízes Tabulares e Contrafortes Esculpidos Mergulhando no Vão Cósmico
      // Raízes reais sinuosas que se entrelaçam e descem para além da tela
      const sculptedRoots = [
        // Extremo esquerdo
        { sx: 0.40, sy: trunkMidY + 10, cp1x: 0.32, cp1y: height * 0.78, cp2x: 0.16, cp2y: height * 0.96, ex: width * 0.06, ey: height * 1.18, w: 22 },
        { sx: 0.41, sy: rootBaseY,       cp1x: 0.34, cp1y: height * 0.84, cp2x: 0.22, cp2y: height * 1.02, ex: width * 0.14, ey: height * 1.22, w: 18 },
        { sx: 0.43, sy: rootBaseY + 8,   cp1x: 0.38, cp1y: height * 0.86, cp2x: 0.29, cp2y: height * 1.05, ex: width * 0.23, ey: height * 1.24, w: 16 },
        { sx: 0.45, sy: rootBaseY + 12,  cp1x: 0.42, cp1y: height * 0.88, cp2x: 0.37, cp2y: height * 1.08, ex: width * 0.33, ey: height * 1.25, w: 15 },
        // Raízes centrais verticais profundas
        { sx: 0.48, sy: rootBaseY + 15,  cp1x: 0.47, cp1y: height * 0.90, cp2x: 0.46, cp2y: height * 1.10, ex: width * 0.45, ey: height * 1.27, w: 17 },
        { sx: 0.52, sy: rootBaseY + 15,  cp1x: 0.53, cp1y: height * 0.90, cp2x: 0.54, cp2y: height * 1.10, ex: width * 0.55, ey: height * 1.27, w: 17 },
        // Extremo direito
        { sx: 0.55, sy: rootBaseY + 12,  cp1x: 0.58, cp1y: height * 0.88, cp2x: 0.63, cp2y: height * 1.08, ex: width * 0.67, ey: height * 1.25, w: 15 },
        { sx: 0.57, sy: rootBaseY + 8,   cp1x: 0.62, cp1y: height * 0.86, cp2x: 0.71, cp2y: height * 1.05, ex: width * 0.77, ey: height * 1.24, w: 16 },
        { sx: 0.59, sy: rootBaseY,       cp1x: 0.66, cp1y: height * 0.84, cp2x: 0.78, cp2y: height * 1.02, ex: width * 0.86, ey: height * 1.22, w: 18 },
        { sx: 0.60, sy: trunkMidY + 10, cp1x: 0.68, cp1y: height * 0.78, cp2x: 0.84, cp2y: height * 0.96, ex: width * 0.94, ey: height * 1.18, w: 22 },
      ];

      sculptedRoots.forEach((rt, rIdx) => {
        const sx = rt.sx < 1 ? rt.sx * width : rt.sx;
        const sy = rt.sy;

        // 1. Bainha de casca externa escura
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(rt.cp1x, rt.cp1y, rt.cp2x, rt.cp2y, rt.ex, rt.ey);
        ctx.strokeStyle = '#011c14';
        ctx.lineWidth = rt.w + 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 2. Madeira muscular verde esmeralda
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(rt.cp1x, rt.cp1y, rt.cp2x, rt.cp2y, rt.ex, rt.ey);
        ctx.strokeStyle = '#023829';
        ctx.lineWidth = rt.w;
        ctx.stroke();

        // 3. Fio de seiva bioluminescente sutil na raiz
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(rt.cp1x, rt.cp1y, rt.cp2x, rt.cp2y, rt.ex, rt.ey);
        ctx.strokeStyle = rIdx % 3 === 0 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(0, 255, 135, 0.85)';
        ctx.lineWidth = rt.w * 0.28;
        ctx.shadowColor = '#00FF87';
        ctx.shadowBlur = 12;
        ctx.stroke();

        // 4. Ramificação secundária natural da raiz
        if (rIdx % 2 === 0) {
          const forkX = rt.ex + (rIdx < 5 ? -25 : 25);
          const forkY = rt.ey - 10;
          ctx.beginPath();
          ctx.moveTo((rt.cp2x + rt.ex) * 0.5, (rt.cp2y + rt.ey) * 0.5);
          ctx.quadraticCurveTo(rt.ex, rt.ey - 15, forkX, forkY);
          ctx.strokeStyle = 'rgba(0, 255, 135, 0.6)';
          ctx.lineWidth = rt.w * 0.22;
          ctx.stroke();
        }
      });

      // D) Textura Esculpida da Casca de Madeira (Sulcos Orgânicos Sinuosos)
      // Substitui as linhas retas de grelha por veios orgânicos que acompanham as curvas da madeira
      for (let s = -5; s <= 5; s++) {
        const norm = s / 5;
        const startX = trunkCenterX + norm * (width * 0.08);
        const startY = rootBaseY - 10;
        const endX = trunkCenterX + norm * (width * 0.12);
        const endY = crotchY - 4;
        const sway = Math.sin(norm * 2.8 + time * 1.2) * 5;

        // Fissura de sombra da casca
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(
          startX + norm * 8 + sway,
          startY - (startY - endY) * 0.35,
          endX - norm * 6 - sway,
          endY + (startY - endY) * 0.4,
          endX,
          endY
        );
        ctx.strokeStyle = '#011c14';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Realce de luz na aresta do sulco
        ctx.beginPath();
        ctx.moveTo(startX + 1.5, startY);
        ctx.bezierCurveTo(
          startX + norm * 8 + sway + 1.5,
          startY - (startY - endY) * 0.35,
          endX - norm * 6 - sway + 1.5,
          endY + (startY - endY) * 0.4,
          endX + 1.5,
          endY
        );
        ctx.strokeStyle = '#056b4f';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Fio delicado de seiva fóton
        if (Math.abs(s) % 2 === 1) {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(
            startX + norm * 8 + sway,
            startY - (startY - endY) * 0.35,
            endX - norm * 6 - sway,
            endY + (startY - endY) * 0.4,
            endX,
            endY
          );
          ctx.strokeStyle = 'rgba(0, 255, 135, 0.7)';
          ctx.lineWidth = 1.0;
          ctx.shadowColor = '#00FF87';
          ctx.shadowBlur = 10;
          ctx.stroke();
        }
      }

      // Coração / Núcleo de seiva bioluminescente suave no centro do tronco
      const heartPulse = 1 + Math.sin(time * 2.2) * 0.12;
      const trunkCoreLight = ctx.createRadialGradient(
        trunkCenterX,
        trunkMidY,
        width * 0.01,
        trunkCenterX,
        trunkMidY,
        width * 0.08 * heartPulse
      );
      trunkCoreLight.addColorStop(0, 'rgba(254, 240, 138, 0.8)');
      trunkCoreLight.addColorStop(0.4, 'rgba(0, 255, 135, 0.4)');
      trunkCoreLight.addColorStop(0.85, 'rgba(6, 182, 212, 0.1)');
      trunkCoreLight.addColorStop(1, 'transparent');
      ctx.fillStyle = trunkCoreLight;
      ctx.beginPath();
      ctx.arc(trunkCenterX, trunkMidY, width * 0.08 * heartPulse, 0, Math.PI * 2);
      ctx.fill();

      // =========================================================================
      // 4. OS 5 GRANDES GALHOS MESTRES DE MADEIRA ESCULPIDA (Fiel à foto da Acácia)
      // =========================================================================
      // Cada galho nasce diretamente do tronco com continuidade orgânica de madeira
      const masterBoughs = [
        // 1. Galho Mestre Esquerdo Inferior (Grande cotovelo horizontal que desce e abre para o lado)
        {
          sx: width * 0.38, sy: crotchY + 2,
          cp1x: width * 0.32, cp1y: crotchY + 8,
          cp2x: width * 0.25, cp2y: height * 0.52,
          ex: width * 0.18, ey: height * 0.48,
          w: 32, subForkY: height * 0.56, subForkX: width * 0.14
        },
        // 2. Galho Mestre Esquerdo Ascendente (Pilar diagonal superior esquerdo)
        {
          sx: width * 0.44, sy: crotchY - 8,
          cp1x: width * 0.38, cp1y: height * 0.44,
          cp2x: width * 0.32, cp2y: height * 0.36,
          ex: width * 0.26, ey: height * 0.28,
          w: 26, subForkY: height * 0.34, subForkX: width * 0.22
        },
        // 3. Galho Mestre Central (Cúpula e coroa do topo da acácia)
        {
          sx: trunkCenterX, sy: crotchY - 14,
          cp1x: width * 0.50, cp1y: height * 0.40,
          cp2x: width * 0.50, cp2y: height * 0.28,
          ex: width * 0.50, ey: height * 0.16,
          w: 24, subForkY: height * 0.24, subForkX: width * 0.44
        },
        // 4. Galho Mestre Direito Ascendente (Pilar diagonal superior direito)
        {
          sx: width * 0.56, sy: crotchY - 8,
          cp1x: width * 0.62, cp1y: height * 0.44,
          cp2x: width * 0.68, cp2y: height * 0.36,
          ex: width * 0.74, ey: height * 0.28,
          w: 26, subForkY: height * 0.34, subForkX: width * 0.78
        },
        // 5. Galho Mestre Direito Inferior (Grande cotovelo horizontal que desce e abre para o lado)
        {
          sx: width * 0.62, sy: crotchY + 2,
          cp1x: width * 0.68, cp1y: crotchY + 8,
          cp2x: width * 0.75, cp2y: height * 0.52,
          ex: width * 0.82, ey: height * 0.48,
          w: 32, subForkY: height * 0.56, subForkX: width * 0.86
        },
      ];

      masterBoughs.forEach((mb, mbIdx) => {
        // Casca externa de madeira escura
        ctx.beginPath();
        ctx.moveTo(mb.sx, mb.sy);
        ctx.bezierCurveTo(mb.cp1x, mb.cp1y, mb.cp2x, mb.cp2y, mb.ex, mb.ey);
        ctx.strokeStyle = '#011e15';
        ctx.lineWidth = mb.w + 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Corpo de madeira viva esmeralda
        ctx.beginPath();
        ctx.moveTo(mb.sx, mb.sy);
        ctx.bezierCurveTo(mb.cp1x, mb.cp1y, mb.cp2x, mb.cp2y, mb.ex, mb.ey);
        ctx.strokeStyle = '#023d2c';
        ctx.lineWidth = mb.w;
        ctx.stroke();

        // Realce de luz jade na aresta superior da madeira
        ctx.beginPath();
        ctx.moveTo(mb.sx, mb.sy);
        ctx.bezierCurveTo(mb.cp1x, mb.cp1y - 2, mb.cp2x, mb.cp2y - 2, mb.ex, mb.ey - 2);
        ctx.strokeStyle = '#056b4f';
        ctx.lineWidth = mb.w * 0.45;
        ctx.stroke();

        // Fio central de seiva bioluminescente
        ctx.beginPath();
        ctx.moveTo(mb.sx, mb.sy);
        ctx.bezierCurveTo(mb.cp1x, mb.cp1y, mb.cp2x, mb.cp2y, mb.ex, mb.ey);
        ctx.strokeStyle = mbIdx === 2 ? '#FEF08A' : 'rgba(0, 255, 135, 0.9)';
        ctx.lineWidth = mb.w * 0.22;
        ctx.shadowColor = '#00FF87';
        ctx.shadowBlur = 16;
        ctx.stroke();

        // Ramificação secundária natural do galho mestre
        ctx.beginPath();
        ctx.moveTo((mb.cp2x + mb.ex) * 0.5, (mb.cp2y + mb.ey) * 0.5);
        ctx.quadraticCurveTo(mb.ex, mb.ey, mb.subForkX, mb.subForkY);
        ctx.strokeStyle = '#023829';
        ctx.lineWidth = mb.w * 0.55;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo((mb.cp2x + mb.ex) * 0.5, (mb.cp2y + mb.ey) * 0.5);
        ctx.quadraticCurveTo(mb.ex, mb.ey, mb.subForkX, mb.subForkY);
        ctx.strokeStyle = 'rgba(0, 255, 135, 0.75)';
        ctx.lineWidth = mb.w * 0.18;
        ctx.stroke();
      });

      // =========================================================================
      // 5. RAMIFICAÇÕES BOTÂNICAS SECUNDÁRIAS E TERCIÁRIAS (CONEXÃO DAS FOLHAS)
      // =========================================================================
      timelineBoughs.forEach((tb, bIdx) => {
        const sway = Math.sin(time * 1.2 + bIdx) * 6;
        const originX = tb.startX * width;
        const originY = tb.startY * height;
        const targetX = tb.endX * width;
        const targetY = tb.endY * height;
        const cp1X = tb.cp1X * width + sway;
        const cp1Y = tb.cp1Y * height;
        const cp2X = tb.cp2X * width + sway * 0.5;
        const cp2Y = tb.cp2Y * height;

        // 1. Madeira do galho botânico
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
        ctx.strokeStyle = '#023023';
        ctx.lineWidth = tb.width * 0.65;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 2. Veio de luz de seiva bioluminescente
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
        ctx.strokeStyle = bIdx % 3 === 0 ? '#FEF08A' : '#00FF87';
        ctx.lineWidth = tb.width * 0.28;
        ctx.shadowColor = '#00FF87';
        ctx.shadowBlur = 14;
        ctx.stroke();

        // 3. Fio ótico central sutil
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, targetX, targetY);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 4. Ramalhetes e galhos terciários que se espalham na copa
        const sub1X = targetX + (bIdx % 2 === 0 ? -36 : 36);
        const sub1Y = targetY - 18;
        ctx.beginPath();
        ctx.moveTo((cp2X + targetX) * 0.5, (cp2Y + targetY) * 0.5);
        ctx.quadraticCurveTo(targetX, targetY - 10, sub1X, sub1Y);
        ctx.strokeStyle = '#023829';
        ctx.lineWidth = tb.width * 0.35;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo((cp2X + targetX) * 0.5, (cp2Y + targetY) * 0.5);
        ctx.quadraticCurveTo(targetX, targetY - 10, sub1X, sub1Y);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = tb.width * 0.16;
        ctx.stroke();

        const sub2X = targetX + (bIdx % 2 === 0 ? 28 : -28);
        const sub2Y = targetY - 26;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.quadraticCurveTo(targetX + (bIdx % 2 === 0 ? 12 : -12), targetY - 16, sub2X, sub2Y);
        ctx.strokeStyle = '#023829';
        ctx.lineWidth = tb.width * 0.25;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.quadraticCurveTo(targetX + (bIdx % 2 === 0 ? 12 : -12), targetY - 16, sub2X, sub2Y);
        ctx.strokeStyle = 'rgba(0, 255, 135, 0.7)';
        ctx.lineWidth = tb.width * 0.14;
        ctx.stroke();
      });

      // Pulsos sutis de seiva correndo pelo tronco
      trunkWirePulses.forEach((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.strandIdx = Math.floor(Math.random() * 20);
        }

        const t = p.progress;
        const py = abyssRootY - (abyssRootY - crotchY) * t;
        const currentTrunkWidth =
          t < 0.4
            ? width * 0.30 * (1 - t * 2.5) + width * 0.18 * (t * 2.5)
            : width * 0.18 * (1 - (t - 0.4) * 1.66) + width * 0.28 * ((t - 0.4) * 1.66);

        const strandNorm = (p.strandIdx - 10) / 10;
        const px =
          trunkCenterX +
          strandNorm * (currentTrunkWidth * 0.38) +
          Math.sin(t * Math.PI * 2.5 + p.strandIdx + time) * 4;

        ctx.beginPath();
        ctx.arc(px, py, p.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
      });

      // =========================================================================
      // 6. FILAMENTOS CAPILARES DELICADOS LIGANDO AS FOLHAS À COPA
      // =========================================================================
      leafPlacements.forEach((lp) => {
        const targetX = (lp.x / 100) * width;
        const targetY = (lp.y / 100) * height;
        const branchX = lp.branchTargetX * width;
        const branchY = lp.branchTargetY * height;

        const isHovered = hoveredFolha?.id === lp.folha.id;
        const isSelected = selectedFolha?.id === lp.folha.id;

        ctx.beginPath();
        ctx.moveTo(branchX, branchY);
        ctx.quadraticCurveTo(
          (branchX + targetX) * 0.5,
          (branchY + targetY) * 0.5 - 4,
          targetX,
          targetY
        );

        ctx.strokeStyle = isSelected
          ? '#FEF08A'
          : isHovered
          ? lp.folha.cor
          : `${lp.folha.cor}25`;
        ctx.lineWidth = isSelected ? 3.0 : isHovered ? 2.0 : 0.9;
        ctx.shadowColor = isSelected ? '#FEF08A' : lp.folha.cor;
        ctx.shadowBlur = isSelected ? 16 : isHovered ? 10 : 2;
        ctx.stroke();

        // Se selecionada, traça o feixe de ouro conectando suavemente ao coração do tronco
        if (isSelected) {
          ctx.beginPath();
          ctx.moveTo(trunkBaseX, trunkMidY);
          ctx.bezierCurveTo(
            trunkTopX,
            trunkTopY,
            branchX,
            branchY,
            targetX,
            targetY
          );
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.8)';
          ctx.lineWidth = 2.0;
          ctx.shadowColor = '#FEF08A';
          ctx.shadowBlur = 18;
          ctx.stroke();
        }
      });

      // =========================================================================
      // 7. PULSOS DE SEIVA BIOLUMINESCENTE FLUINDO PELAS CURVAS DOS GALHOS
      // =========================================================================
      temporalPulses.forEach((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulse.progress = 0;
          pulse.boughIdx = Math.floor(Math.random() * timelineBoughs.length);
        }

        const bough = timelineBoughs[pulse.boughIdx];
        const p0x = bough.startX * width;
        const p0y = bough.startY * height;
        const p1x = bough.cp1X * width;
        const p1y = bough.cp1Y * height;
        const p2x = bough.cp2X * width;
        const p2y = bough.cp2Y * height;
        const p3x = bough.endX * width;
        const p3y = bough.endY * height;

        const t = pulse.progress;
        const mt = 1 - t;
        const px =
          mt * mt * mt * p0x +
          3 * mt * mt * t * p1x +
          3 * mt * t * t * p2x +
          t * t * t * p3x;
        const py =
          mt * mt * mt * p0y +
          3 * mt * mt * t * p1y +
          3 * mt * t * t * p2y +
          t * t * t * p3y;

        ctx.beginPath();
        ctx.arc(px, py, pulse.size * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 14;
        ctx.fill();
      });

      // =========================================================================
      // 4. FILAMENTOS CAPILARES LIGANDO AS FOLHAS ÀS LINHAS TEMPORAIS
      // =========================================================================
      leafPlacements.forEach((lp) => {
        const targetX = (lp.x / 100) * width;
        const targetY = (lp.y / 100) * height;
        const branchX = lp.branchTargetX * width;
        const branchY = lp.branchTargetY * height;

        const isHovered = hoveredFolha?.id === lp.folha.id;
        const isSelected = selectedFolha?.id === lp.folha.id;

        ctx.beginPath();
        ctx.moveTo(branchX, branchY);
        ctx.quadraticCurveTo(
          (branchX + targetX) * 0.5,
          (branchY + targetY) * 0.5 - 6,
          targetX,
          targetY
        );

        ctx.strokeStyle = isSelected
          ? '#FEF08A'
          : isHovered
          ? lp.folha.cor
          : `${lp.folha.cor}30`;
        ctx.lineWidth = isSelected ? 3.5 : isHovered ? 2.5 : 1.1;
        ctx.shadowColor = isSelected ? '#FEF08A' : lp.folha.cor;
        ctx.shadowBlur = isSelected ? 20 : isHovered ? 14 : 3;
        ctx.stroke();

        // Se selecionada, traça o feixe de ouro conectando diretamente ao coração do tronco ampliado
        if (isSelected) {
          ctx.beginPath();
          ctx.moveTo(trunkBaseX, trunkMidY);
          ctx.bezierCurveTo(
            trunkTopX,
            trunkTopY,
            branchX,
            branchY,
            targetX,
            targetY
          );
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
          ctx.lineWidth = 2.4;
          ctx.shadowColor = '#FEF08A';
          ctx.shadowBlur = 22;
          ctx.stroke();
        }
      });

      // =========================================================================
      // 5. PULSOS TEMPORAIS FLUINDO AO LONGO DAS CURVAS BEZIER DOS GALHOS
      // =========================================================================
      temporalPulses.forEach((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulse.progress = 0;
          pulse.boughIdx = Math.floor(Math.random() * timelineBoughs.length);
        }

        const bough = timelineBoughs[pulse.boughIdx];
        const p0x = bough.startX * width;
        const p0y = bough.startY * height;
        const p1x = bough.cp1X * width;
        const p1y = bough.cp1Y * height;
        const p2x = bough.cp2X * width;
        const p2y = bough.cp2Y * height;
        const p3x = bough.endX * width;
        const p3y = bough.endY * height;

        // Interpolação cúbica de Bezier para o pulso acompanhar a curva exata do galho
        const t = pulse.progress;
        const mt = 1 - t;
        const px =
          mt * mt * mt * p0x +
          3 * mt * mt * t * p1x +
          3 * mt * t * t * p2x +
          t * t * t * p3x;
        const py =
          mt * mt * mt * p0y +
          3 * mt * mt * t * p1y +
          3 * mt * t * t * p2y +
          t * t * t * p3y;

        ctx.beginPath();
        ctx.arc(px, py, pulse.size, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 18;
        ctx.fill();
      });

      cosmicSparks.forEach((sp) => {
        sp.x += sp.vx + Math.sin(time + sp.y * 0.02) * 0.25;
        sp.y += sp.vy;

        if (sp.y < 0) {
          sp.y = height + 10;
          sp.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fillStyle = sp.color;
        ctx.shadowColor = sp.color;
        ctx.shadowBlur = 10;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [timelineBoughs, leafPlacements, selectedFolha, hoveredFolha]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
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

  const handleSelectLeaf = (folha: Folha) => {
    onSelectFolha(folha);
    playCosmicChime(587);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-slate-950 flex flex-col justify-between transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : 'rounded-3xl border border-emerald-900/60 shadow-2xl min-h-[660px] h-[78vh]'
      }`}
    >
      {/* 1. Canvas Central Cósmico: Vazio do Fim dos Tempos, Tronco de Fios Trançados e Galhos de Yggdrasil */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      />

      {/* 2. Camada Interativa das Folhas Temporais de Árvore */}
      <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto">
        {filteredLeaves.map((lp, idx) => {
          const isSelected = selectedFolha?.id === lp.folha.id;
          const isHovered = hoveredFolha?.id === lp.folha.id;
          const isNewest = idx === 0;

          const leafW = 20 * lp.scale * leafSizeMultiplier;
          const leafH = 34 * lp.scale * leafSizeMultiplier;

          return (
            <div
              key={lp.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{
                left: `${lp.x}%`,
                top: `${lp.y}%`,
                zIndex: isSelected ? 40 : isHovered ? 35 : 20,
              }}
              onMouseEnter={() => {
                setHoveredFolha(lp.folha);
                playCosmicChime(659);
              }}
              onMouseLeave={() => setHoveredFolha(null)}
              onClick={() => handleSelectLeaf(lp.folha)}
            >
              <div
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isSelected
                    ? 'scale-160 drop-shadow-[0_0_24px_#FEF08A]'
                    : isHovered
                    ? 'scale-140'
                    : 'hover:scale-120'
                }`}
                style={{
                  transform: `rotate(${lp.angle}deg)`,
                  animation: `sway 4.5s ease-in-out infinite alternate`,
                  animationDelay: `${lp.swayDelay}s`,
                }}
              >
                <svg
                  width={leafW}
                  height={leafH}
                  viewBox="-14 -34 28 42"
                  className="overflow-visible"
                  style={{
                    filter: `drop-shadow(0 0 ${isSelected ? '18px' : isHovered ? '12px' : '7px'} ${
                      isSelected ? '#FEF08A' : lp.folha.cor
                    })`,
                  }}
                >
                  <defs>
                    <linearGradient
                      id={`yggdrasil-leaf-${lp.id}`}
                      x1="0"
                      y1="1"
                      x2="0"
                      y2="0"
                    >
                      <stop offset="0%" stopColor={lp.folha.cor} stopOpacity="0.7" />
                      <stop offset="55%" stopColor={lp.folha.cor} stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M 0,0 Q 0,4 0,7"
                    stroke={isSelected ? '#FEF08A' : lp.folha.cor}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />

                  <path
                    d="M 0,0 C -9.5,-9 -11.5,-21 0,-32 C 11.5,-21 9.5,-9 0,0 Z"
                    fill={`url(#yggdrasil-leaf-${lp.id})`}
                    stroke={isSelected ? '#FEF08A' : '#FFFFFF'}
                    strokeWidth={isSelected ? '2' : '0.9'}
                    strokeOpacity={isSelected ? 1 : 0.8}
                  />

                  <path
                    d="M 0,-2 Q 0,-16 0,-30"
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeOpacity="0.95"
                  />

                  <path
                    d="M 0,-8 Q -4,-13 -7,-15 M 0,-15 Q -5,-19 -7,-22 M 0,-8 Q 4,-13 7,-15 M 0,-15 Q 5,-19 7,-22"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeOpacity="0.65"
                  />

                  <circle cx="0" cy="-31" r="1.6" fill="#FFFFFF" opacity="0.95" />
                </svg>

                {isNewest && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping shadow-lg"
                    style={{ backgroundColor: lp.folha.cor }}
                  />
                )}
              </div>

              {isHovered && (
                <div
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-slate-950/95 border px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{ borderColor: lp.folha.cor }}
                >
                  <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block animate-pulse"
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
        })}
      </div>

      {/* 3. Barra Superior HUD do Telão Cósmico de Yggdrasil */}
      <div className="relative z-30 p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 pointer-events-auto bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-900/85 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur">
            <TreeDeciduous className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[11px] font-black tracking-wider bg-gradient-to-r from-emerald-400 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                ÁRVORE ANCESTRAL • TRONCO ESCULPIDO
              </span>
              <span className="text-[9px] text-amber-400/80 font-mono">
                Raízes Tabulares, Contrafortes & Espelho d'Água
              </span>
            </div>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-300">
              <strong className="text-white font-mono">{folhas.length}</strong> folhas vivas
            </span>
          </div>

          <div className="hidden md:flex items-center bg-slate-900/85 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus-within:border-emerald-400">
            <Search className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar aluno ou destino..."
              className="bg-transparent focus:outline-none text-xs text-white placeholder-slate-500 w-36"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-slate-500 hover:text-white ml-1 text-xs"
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
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-900/70 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              ))}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-xl text-[11px] text-slate-400">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Escala:</span>
            <button
              onClick={() => setLeafSizeMultiplier((m) => Math.max(0.7, m - 0.15))}
              className="px-1.5 py-0.5 hover:text-white font-bold"
              title="Reduzir tamanho das folhas"
            >
              -
            </button>
            <span className="font-mono text-emerald-400 text-xs">
              {Math.round(leafSizeMultiplier * 100)}%
            </span>
            <button
              onClick={() => setLeafSizeMultiplier((m) => Math.min(1.6, m + 0.15))}
              className="px-1.5 py-0.5 hover:text-white font-bold"
              title="Aumentar tamanho das folhas"
            >
              +
            </button>
          </div>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl text-xs font-semibold transition border shadow-md ${
              audioEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-700/80'
            }`}
            title={audioEnabled ? 'Desativar Sons Cósmicos' : 'Ativar Efeitos Cósmicos'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setAutoTourActive(!autoTourActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border shadow-md ${
              autoTourActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700/80'
            }`}
            title="Percorre suavemente os sonhos dos alunos no telão"
          >
            {autoTourActive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar Tour</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tour Cósmico</span>
              </>
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition shadow-md"
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
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-full bg-slate-950/95 border-2 rounded-3xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ borderColor: selectedFolha.cor }}
        >
          <button
            onClick={onClearSelection}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 text-sm"
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
              <svg width="28" height="38" viewBox="-14 -32 28 38">
                <path
                  d="M 0,0 C -9,-9 -11,-20 0,-30 C 11,-20 9,-9 0,0 Z"
                  fill={selectedFolha.cor}
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                />
                <path d="M 0,-2 Q 0,-15 0,-28" stroke="#FFFFFF" strokeWidth="1" />
              </svg>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-white truncate">
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
              <p className="text-sm font-bold text-amber-300">
                {selectedFolha.profissao}
              </p>

              {selectedFolha.mensagem && (
                <p className="text-xs text-slate-300 italic pt-1 border-t border-slate-800/80">
                  "{selectedFolha.mensagem}"
                </p>
              )}
            </div>
          </div>

          {selectedFolha.assinatura && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-4">
              <div className="text-[10px] text-slate-500 uppercase font-mono">
                Assinatura Autêntica Registrada
              </div>
              <div className="h-12 max-w-[200px] flex items-center justify-end bg-slate-900/90 px-3 rounded-xl border border-slate-800">
                <img
                  src={selectedFolha.assinatura}
                  alt={`Assinatura de ${selectedFolha.nome}`}
                  className="max-h-10 object-contain invert hue-rotate-180 brightness-150"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Rodapé Minimalista */}
      <div className="relative z-30 pb-3 text-center pointer-events-none">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-emerald-900/60 text-[10px] text-slate-400 backdrop-blur">
          <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
          <span>Árvore Ancestral • Tronco Esculpido com Raízes Tabulares e Espelho d'Água</span>
        </div>
      </div>
    </div>
  );
}
