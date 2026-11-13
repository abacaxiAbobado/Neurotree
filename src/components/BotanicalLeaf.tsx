import React, { memo, useMemo } from 'react';

interface BotanicalLeafProps {
  id: string;
  color: string;
  width: number;
  height: number;
  isSelected?: boolean;
  isHovered?: boolean;
  uidSuffix?: string;
}

interface LeafPalette {
  petiole: string;
  deepBase: string;
  midTone: string;
  luminousCore: string;
  tipGlow: string;
  shadowHalf: string;
  highlightHalf: string;
  edgeStroke: string;
  veinPrimary: string;
  veinSecondary: string;
}

interface BotanicalArchetype {
  /** Contorno completo da lâmina foliar com assimetria orgânica, nascendo em (0,-3) */
  silhouette: string;
  /** Meia-lâmina sombreada para dar volume tridimensional e curvatura natural */
  shadedHalf: string;
  /** Área interna translúcida (mesofilo luminoso) */
  innerGlow: string;
  /** Posição do centro do brilho radial interno */
  glowCenter: { cx: number; cy: number; r: number };
  /** Pecíolo (cabinho) saindo exatamente da ponta do galho (0,0) até a base da lâmina */
  petiole: string;
  /** Nervura central curva acompanhando a assimetria da folha */
  midrib: string;
  /** Nervuras secundárias alternadas e curvas */
  veins: string[];
}

const parseHexColor = (rawHex: string): [number, number, number] => {
  const cleaned = (rawHex || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return [245, 196, 81]; // fallback Ouro Solar (#F5C451)
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
};

const hsla = (h: number, s: number, l: number, a = 1): string => {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.max(0, Math.min(100, s));
  const lig = Math.max(0, Math.min(100, l));
  return `hsla(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${lig.toFixed(1)}%, ${a})`;
};

export const deriveLeafPalette = (hex: string): LeafPalette => {
  const [r, g, b] = parseHexColor(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  // Garante riqueza cromática mesmo em cores muito claras ou muito escuras
  const richS = Math.max(48, Math.min(96, s));
  const baseL = Math.max(30, Math.min(72, l));

  return {
    petiole: hsla(h - 8, Math.min(85, richS * 0.85), Math.max(20, baseL * 0.45), 0.95),
    deepBase: hsla(h - 10, Math.min(98, richS + 8), Math.max(18, baseL * 0.48), 0.94),
    midTone: hsla(h, richS, baseL, 0.86),
    luminousCore: hsla(h + 8, Math.min(100, richS + 10), Math.min(80, baseL + 17), 0.78),
    tipGlow: hsla(h + 14, Math.min(100, richS + 6), Math.min(82, baseL + 20), 0.88),
    shadowHalf: hsla(h - 12, Math.min(96, richS + 6), Math.max(14, baseL * 0.36), 0.38),
    highlightHalf: hsla(h + 10, Math.min(100, richS + 8), Math.min(86, baseL + 24), 0.24),
    edgeStroke: hsla(h + 6, Math.min(100, richS + 10), Math.min(76, baseL + 14), 0.42),
    veinPrimary: hsla(h + 16, Math.min(92, Math.max(40, richS * 0.78)), Math.min(90, baseL + 30), 0.62),
    veinSecondary: hsla(h + 12, Math.min(88, Math.max(36, richS * 0.72)), Math.min(88, baseL + 26), 0.34),
  };
};

export const hashLeafId = (str: string): number => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * 5 arquétipos botânicos assimétricos reais, todos ancorados com a base do pecíolo em (0, 0)
 * no viewBox="-18 -46 36 50".
 */
const BOTANICAL_ARCHETYPES: BotanicalArchetype[] = [
  // 0. Lanceolada Curva (folha esguia e sinuosa, curvando suavemente para a direita no ápice)
  {
    petiole: 'M 0,0 C -0.4,-1.8 -0.8,-3.5 -0.3,-5.5',
    silhouette:
      'M -0.3,-5.0 C -7.2,-9.5 -10.2,-20.5 -5.8,-31.5 C -3.0,-38.2 1.2,-42.2 4.6,-44.2 C 3.4,-39.5 6.8,-32.4 7.6,-23.0 C 8.3,-14.4 5.0,-8.2 -0.3,-5.0 Z',
    shadedHalf:
      'M -0.3,-5.0 C 0.2,-14.5 1.8,-25.5 3.6,-35.5 C 4.2,-39.4 4.5,-42.1 4.6,-44.2 C 3.4,-39.5 6.8,-32.4 7.6,-23.0 C 8.3,-14.4 5.0,-8.2 -0.3,-5.0 Z',
    innerGlow:
      'M -0.2,-8.5 C -4.6,-13.0 -6.4,-21.0 -3.4,-29.2 C -1.4,-34.4 1.2,-37.4 2.8,-38.8 C 2.4,-34.5 4.4,-28.5 4.7,-21.4 C 5.0,-15.2 2.8,-10.8 -0.2,-8.5 Z',
    glowCenter: { cx: -0.6, cy: -22, r: 12 },
    midrib: 'M -0.3,-5.0 C -0.6,-14.0 0.8,-25.0 3.0,-35.5 C 3.7,-39.0 4.2,-41.8 4.4,-43.4',
    veins: [
      'M -0.4,-11.5 C -3.4,-13.5 -5.8,-16.8 -7.1,-20.2',
      'M 0.1,-14.5 C 3.1,-16.2 5.4,-19.0 6.5,-22.2',
      'M 0.2,-19.8 C -2.8,-22.0 -4.8,-25.2 -5.5,-28.8',
      'M 1.0,-23.5 C 3.5,-25.2 5.2,-27.8 5.8,-30.8',
      'M 1.4,-29.2 C -0.8,-31.4 -2.2,-34.0 -2.6,-36.8',
      'M 2.3,-32.6 C 4.0,-34.2 4.9,-36.2 5.0,-38.4',
    ],
  },

  // 1. Ovada Assimétrica (lâmina botânica clássica com barriga assimétrica e ponta delicada)
  {
    petiole: 'M 0,0 C 0.6,-1.7 0.2,-3.6 -0.2,-5.2',
    silhouette:
      'M -0.2,-4.8 C -9.8,-7.8 -13.6,-18.0 -9.4,-28.4 C -6.4,-35.6 -2.4,-40.0 -1.0,-43.6 C 2.6,-39.0 8.6,-33.4 10.6,-24.6 C 12.6,-15.6 8.2,-7.6 -0.2,-4.8 Z',
    shadedHalf:
      'M -0.2,-4.8 C -1.8,-14.6 -1.6,-26.0 -0.8,-36.2 C -0.7,-39.6 -0.9,-41.8 -1.0,-43.6 C 2.6,-39.0 8.6,-33.4 10.6,-24.6 C 12.6,-15.6 8.2,-7.6 -0.2,-4.8 Z',
    innerGlow:
      'M -0.4,-8.2 C -6.8,-11.0 -9.2,-18.2 -6.2,-26.0 C -4.2,-31.5 -1.8,-34.8 -0.9,-37.4 C 1.8,-33.8 6.0,-29.6 7.2,-23.2 C 8.4,-16.2 5.4,-10.2 -0.4,-8.2 Z',
    glowCenter: { cx: -0.8, cy: -20, r: 13 },
    midrib: 'M -0.2,-4.8 C -1.5,-14.4 -1.5,-25.6 -0.9,-36.2 C -0.8,-39.2 -0.9,-41.4 -1.0,-42.8',
    veins: [
      'M -0.8,-10.6 C -4.6,-12.0 -7.8,-14.8 -9.6,-18.6',
      'M -1.1,-13.4 C 3.4,-14.0 6.8,-16.6 8.8,-20.6',
      'M -1.4,-19.2 C -5.2,-20.8 -7.8,-23.6 -9.0,-27.0',
      'M -1.3,-22.2 C 3.0,-23.2 6.2,-25.6 8.0,-29.2',
      'M -1.2,-28.2 C -3.8,-29.8 -5.4,-32.2 -6.0,-35.0',
      'M -1.0,-31.4 C 2.0,-32.4 4.2,-34.4 5.2,-37.0',
    ],
  },

  // 2. Folíolo de Acácia / Bordo Sinuoso (estreita na base, levemente curva, ponta fina)
  {
    petiole: 'M 0,0 C -0.5,-1.8 -0.2,-3.6 0.2,-5.4',
    silhouette:
      'M 0.2,-5.0 C -5.4,-10.0 -7.8,-19.0 -4.8,-28.8 C -2.8,-35.2 -5.2,-39.5 -3.4,-44.4 C 1.4,-40.4 5.8,-34.4 7.4,-26.6 C 9.2,-17.8 6.0,-9.8 0.2,-5.0 Z',
    shadedHalf:
      'M 0.2,-5.0 C 1.4,-14.4 1.2,-24.6 -0.8,-34.4 C -1.7,-38.8 -2.8,-42.0 -3.4,-44.4 C 1.4,-40.4 5.8,-34.4 7.4,-26.6 C 9.2,-17.8 6.0,-9.8 0.2,-5.0 Z',
    innerGlow:
      'M 0.2,-8.6 C -3.6,-13.0 -5.0,-19.8 -2.8,-27.4 C -1.4,-32.4 -2.8,-35.8 -1.8,-39.0 C 1.4,-35.6 4.0,-30.8 4.8,-24.6 C 5.8,-18.0 3.8,-11.8 0.2,-8.6 Z',
    glowCenter: { cx: 0.2, cy: -22, r: 11 },
    midrib: 'M 0.2,-5.0 C 1.1,-14.2 0.9,-24.2 -1.0,-34.0 C -1.9,-38.4 -2.8,-41.4 -3.2,-43.4',
    veins: [
      'M 0.6,-11.2 C -2.2,-13.4 -4.4,-16.6 -5.2,-20.2',
      'M 0.8,-14.0 C 3.8,-15.8 5.6,-18.8 6.4,-22.4',
      'M 0.6,-20.2 C -2.0,-22.2 -3.6,-25.0 -4.2,-28.4',
      'M 0.4,-23.4 C 3.4,-24.8 5.2,-27.4 5.6,-30.8',
      'M -0.4,-29.8 C -2.4,-31.8 -3.4,-34.4 -3.6,-37.2',
    ],
  },

  // 3. Cordiforme Curva / Tília Astral (base em coração assimétrico com ponta arqueada)
  {
    petiole: 'M 0,0 C 0.3,-1.8 0.5,-3.6 0.0,-5.4',
    silhouette:
      'M 0.0,-5.0 C -4.6,-3.4 -11.4,-6.8 -12.6,-15.2 C -13.8,-23.4 -8.2,-31.8 -2.4,-38.0 C 0.0,-40.6 1.8,-42.6 3.6,-44.2 C 3.8,-40.0 7.6,-34.2 10.2,-26.4 C 12.8,-18.2 11.0,-7.4 3.4,-5.0 C 1.8,-4.5 0.8,-4.8 0.0,-5.0 Z',
    shadedHalf:
      'M 0.0,-5.0 C -0.6,-15.0 0.2,-25.4 1.6,-35.6 C 2.3,-39.6 3.0,-42.2 3.6,-44.2 C 3.8,-40.0 7.6,-34.2 10.2,-26.4 C 12.8,-18.2 11.0,-7.4 3.4,-5.0 C 1.8,-4.5 0.8,-4.8 0.0,-5.0 Z',
    innerGlow:
      'M 0.0,-8.6 C -4.6,-8.6 -9.0,-11.4 -9.4,-17.0 C -9.8,-22.8 -5.4,-29.2 -1.2,-33.8 C 0.6,-35.8 1.6,-37.4 2.6,-38.8 C 3.2,-35.0 5.6,-30.2 7.2,-24.0 C 8.8,-17.8 7.0,-10.2 2.2,-8.6 Z',
    glowCenter: { cx: -0.4, cy: -19, r: 13 },
    midrib: 'M 0.0,-5.0 C -0.4,-14.6 0.2,-24.8 1.6,-35.2 C 2.2,-38.8 2.9,-41.4 3.4,-43.2',
    veins: [
      'M -0.1,-9.6 C -4.6,-9.6 -8.4,-11.6 -10.8,-15.4',
      'M 0.0,-10.6 C 4.4,-10.2 7.8,-12.6 9.6,-16.8',
      'M -0.1,-17.0 C -4.4,-18.2 -7.6,-20.8 -9.6,-24.6',
      'M 0.3,-18.8 C 4.2,-19.6 7.0,-22.0 8.6,-25.8',
      'M 0.7,-26.0 C -2.2,-27.4 -4.6,-29.6 -5.8,-32.6',
      'M 1.2,-28.2 C 3.8,-29.2 5.6,-31.4 6.6,-34.2',
    ],
  },

  // 4. Lâmina Ondulada Orgânica (margem com leve ondulação natural, estilo carvalho/botânico fino)
  {
    petiole: 'M 0,0 C -0.6,-1.6 -0.6,-3.4 -0.1,-5.0',
    silhouette:
      'M -0.1,-4.8 C -6.2,-7.6 -10.8,-13.4 -9.6,-19.6 C -8.8,-23.0 -10.4,-25.6 -8.4,-29.8 C -6.4,-34.2 -3.4,-38.4 -1.4,-43.8 C 2.6,-39.4 6.6,-35.0 8.0,-29.2 C 9.2,-24.6 11.2,-22.0 9.6,-16.4 C 8.0,-11.0 5.0,-6.8 -0.1,-4.8 Z',
    shadedHalf:
      'M -0.1,-4.8 C 0.8,-14.2 0.2,-25.2 -0.6,-35.6 C -1.0,-39.2 -1.2,-41.8 -1.4,-43.8 C 2.6,-39.4 6.6,-35.0 8.0,-29.2 C 9.2,-24.6 11.2,-22.0 9.6,-16.4 C 8.0,-11.0 5.0,-6.8 -0.1,-4.8 Z',
    innerGlow:
      'M -0.1,-8.2 C -4.4,-10.2 -7.4,-14.4 -6.6,-19.4 C -6.0,-22.6 -6.8,-24.8 -5.4,-28.2 C -3.8,-32.0 -2.2,-34.8 -1.0,-38.2 C 1.8,-34.8 4.4,-31.4 5.4,-26.8 C 6.2,-23.0 7.4,-20.6 6.2,-16.2 C 5.0,-12.0 3.2,-9.4 -0.1,-8.2 Z',
    glowCenter: { cx: 0, cy: -21, r: 12.5 },
    midrib: 'M -0.1,-4.8 C 0.6,-14.2 0.2,-25.0 -0.6,-35.4 C -0.9,-38.8 -1.2,-41.4 -1.3,-43.0',
    veins: [
      'M 0.2,-10.8 C -3.6,-12.2 -6.6,-14.6 -8.4,-17.8',
      'M 0.4,-13.2 C 4.2,-14.4 7.0,-16.8 8.4,-19.8',
      'M 0.3,-20.2 C -3.4,-21.8 -6.2,-24.2 -7.8,-27.4',
      'M 0.1,-22.8 C 3.6,-24.0 6.0,-26.2 7.2,-29.2',
      'M -0.3,-29.6 C -2.8,-31.2 -4.6,-33.4 -5.4,-36.0',
      'M -0.5,-32.4 C 2.2,-33.4 4.0,-35.2 4.8,-37.4',
    ],
  },
];

export const BotanicalLeaf = memo(function BotanicalLeaf({
  id,
  color,
  width,
  height,
  isSelected = false,
  isHovered = false,
  uidSuffix = 'tree',
}: BotanicalLeafProps) {
  const { archetype, flipX, palette, safeUid } = useMemo(() => {
    const h = hashLeafId(id || 'leaf');
    const archIdx = h % BOTANICAL_ARCHETYPES.length;
    const mirror = ((h >>> 3) & 1) === 1;
    const cleanedUid = `${uidSuffix}-${id}`
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48);

    return {
      archetype: BOTANICAL_ARCHETYPES[archIdx],
      flipX: mirror,
      palette: deriveLeafPalette(color),
      safeUid: cleanedUid,
    };
  }, [id, color, uidSuffix]);

  const bladeGradId = `leaf-blade-${safeUid}`;
  const glowGradId = `leaf-glow-${safeUid}`;
  const veinGradId = `leaf-vein-${safeUid}`;

  const shadowBlur = isSelected ? '14px' : '9px';
  const shadowColor = isSelected ? '#FEF08A' : color;

  return (
    <svg
      width={width}
      height={height}
      viewBox="-18 -46 36 50"
      className="overflow-visible block"
      style={
        isSelected || isHovered
          ? { filter: `drop-shadow(0 0 ${shadowBlur} ${shadowColor})` }
          : undefined
      }
    >
      <defs>
        {/* Degradê principal rico na cor escolhida (base profunda -> lâmina vibrante -> ápice luminoso sem estourar para branco) */}
        <linearGradient id={bladeGradId} x1="0" y1="1" x2="0.15" y2="0">
          <stop offset="0%" stopColor={palette.deepBase} />
          <stop offset="38%" stopColor={palette.midTone} />
          <stop offset="78%" stopColor={palette.luminousCore} />
          <stop offset="100%" stopColor={palette.tipGlow} />
        </linearGradient>

        {/* Brilho interno translúcido suave (mesofilo vivo) */}
        <radialGradient
          id={glowGradId}
          cx="50%"
          cy="48%"
          r="52%"
          fx="46%"
          fy="44%"
        >
          <stop offset="0%" stopColor={palette.tipGlow} stopOpacity="0.62" />
          <stop offset="55%" stopColor={palette.luminousCore} stopOpacity="0.28" />
          <stop offset="100%" stopColor={palette.midTone} stopOpacity="0" />
        </radialGradient>

        {/* Nervura com leve transição de brilho da base até a ponta */}
        <linearGradient id={veinGradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={palette.veinPrimary} stopOpacity="0.92" />
          <stop offset="65%" stopColor={palette.veinPrimary} stopOpacity="0.72" />
          <stop offset="100%" stopColor={palette.veinPrimary} stopOpacity="0.32" />
        </linearGradient>
      </defs>

      <g transform={flipX ? 'scale(-1, 1)' : undefined}>
        {/* 1. Pecíolo conectando o galho (0,0) diretamente à base da folha */}
        <path
          d={archetype.petiole}
          stroke={isSelected ? '#FEF08A' : palette.petiole}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* 2. Lâmina foliar principal com degradê translúcido e contorno orgânico sutil na própria cor */}
        <path
          d={archetype.silhouette}
          fill={`url(#${bladeGradId})`}
          stroke={isSelected ? 'rgba(254, 240, 138, 0.85)' : palette.edgeStroke}
          strokeWidth={isSelected ? '0.95' : '0.45'}
          strokeLinejoin="round"
        />

        {/* 3. Volume 3D natural: metade sombreada ao longo da nervura central */}
        <path
          d={archetype.shadedHalf}
          fill={palette.shadowHalf}
          pointerEvents="none"
        />

        {/* 4. Translucidez interna suave (luz atravessando a folha) */}
        <path
          d={archetype.innerGlow}
          fill={`url(#${glowGradId})`}
          pointerEvents="none"
        />

        {/* 5. Nervuras secundárias alternadas e curvas */}
        <g
          stroke={isSelected ? 'rgba(254, 249, 195, 0.52)' : palette.veinSecondary}
          strokeWidth="0.52"
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
        >
          {archetype.veins.map((vPath, i) => (
            <path key={i} d={vPath} />
          ))}
        </g>

        {/* 6. Nervura central curva acompanhando a anatomia da lâmina */}
        <path
          d={archetype.midrib}
          stroke={isSelected ? '#FEF9C3' : `url(#${veinGradId})`}
          strokeWidth="0.95"
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
        />
      </g>
    </svg>
  );
});
