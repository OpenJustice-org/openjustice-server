/**
 * SVG Templates for Poster Image Generation
 *
 * Creates SVG overlays for text and shapes used in poster generation
 * These SVGs are composited onto images using Sharp
 */

import { PosterBranding } from './poster.types';
import { getImageDimensions } from './poster.config';

const dims = getImageDimensions();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function generateHeaderSvg(
  branding: PosterBranding,
  bulletinNumber: string,
  badgeText: string,
  badgeColor: string,
): string {
  const orgName = escapeXml(truncate(branding.organizationName, 40));
  const bulletin = escapeXml(bulletinNumber);
  const badge = escapeXml(badgeText);

  return `
    <svg width="${dims.width}" height="80" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <line x1="40" y1="75" x2="${dims.width - 40}" y2="75" stroke="#E5E7EB" stroke-width="1"/>
      <text x="50" y="35" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#1F2937">
        ${orgName}
      </text>
      <text x="50" y="55" font-family="Arial, sans-serif" font-size="12" fill="#6B7280">
        Bulletin No. ${bulletin}
      </text>
      <rect x="${dims.width - 250}" y="15" width="210" height="40" rx="4" fill="${badgeColor}"/>
      <text x="${dims.width - 145}" y="42" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">
        ${badge}
      </text>
    </svg>
  `;
}

export function generateBannerSvg(
  text: string,
  backgroundColor: string,
  textColor: string,
): string {
  const bannerText = escapeXml(text);

  return `
    <svg width="${dims.width}" height="90" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${backgroundColor}"/>
      <text x="${dims.width / 2}" y="60" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="${textColor}" text-anchor="middle" letter-spacing="8">
        ${bannerText}
      </text>
    </svg>
  `;
}

export function generateMissingDurationSvg(days: number): string {
  const text = `MISSING FOR ${days} DAY${days !== 1 ? 'S' : ''}`;

  return `
    <svg width="${dims.width}" height="40" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#DC2626"/>
      <text x="${dims.width / 2}" y="27" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="2">
        ${escapeXml(text)}
      </text>
    </svg>
  `;
}

export function generateDetailsPanelSvg(
  details: Array<{ label: string; value: string }>,
  labelBgColor: string,
  valueBgColor: string,
): string {
  const panelWidth = 450;
  const rowHeight = 70;
  const startX = dims.width - panelWidth - 50;
  let svgContent = `<svg width="${dims.width}" height="${details.length * rowHeight + 20}" xmlns="http://www.w3.org/2000/svg">`;

  details.forEach((detail, index) => {
    const y = index * rowHeight + 10;
    const label = escapeXml(truncate(detail.label, 20));
    const value = escapeXml(truncate(detail.value, 40));

    svgContent += `
      <rect x="${startX}" y="${y}" width="${panelWidth}" height="25" fill="${labelBgColor}"/>
      <text x="${startX + 15}" y="${y + 18}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="white">
        ${label}
      </text>
      <rect x="${startX}" y="${y + 25}" width="${panelWidth}" height="40" fill="${valueBgColor}"/>
      <text x="${startX + 15}" y="${y + 50}" font-family="Arial, sans-serif" font-size="15" fill="#1F2937">
        ${value}
      </text>
    `;
  });

  svgContent += '</svg>';
  return svgContent;
}

export function generateTextSectionSvg(
  title: string,
  content: string,
  backgroundColor: string = '#F9FAFB',
): string {
  const sectionTitle = escapeXml(title);
  const sectionContent = escapeXml(truncate(content, 200));

  return `
    <svg width="${dims.width}" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="0" width="${dims.width - 80}" height="90" rx="4" fill="${backgroundColor}"/>
      <text x="55" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1F2937">
        ${sectionTitle}
      </text>
      <text x="55" y="50" font-family="Arial, sans-serif" font-size="12" fill="#374151">
        <tspan x="55" dy="0">${sectionContent.substring(0, 80)}</tspan>
        <tspan x="55" dy="18">${sectionContent.substring(80, 160)}</tspan>
        <tspan x="55" dy="18">${sectionContent.substring(160)}</tspan>
      </text>
    </svg>
  `;
}

export function generateAdvisorySvg(
  content: string,
  borderColor: string,
  backgroundColor: string,
): string {
  const advisoryContent = escapeXml(truncate(content, 250));

  return `
    <svg width="${dims.width}" height="110" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="0" width="${dims.width - 80}" height="100" fill="${backgroundColor}"/>
      <rect x="40" y="0" width="4" height="100" fill="${borderColor}"/>
      <text x="60" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1F2937">
        PUBLIC ADVISORY
      </text>
      <text x="60" y="50" font-family="Arial, sans-serif" font-size="11" fill="#374151">
        <tspan x="60" dy="0">${advisoryContent.substring(0, 70)}</tspan>
        <tspan x="60" dy="16">${advisoryContent.substring(70, 140)}</tspan>
        <tspan x="60" dy="16">${advisoryContent.substring(140, 210)}</tspan>
        <tspan x="60" dy="16">${advisoryContent.substring(210)}</tspan>
      </text>
    </svg>
  `;
}

export function generateHelpSectionSvg(
  contactPhone: string,
  hotline: string,
  reward?: string | null,
  backgroundColor: string = '#FEF9C3',
): string {
  const phone = escapeXml(contactPhone);
  const emergency = escapeXml(hotline);
  const rewardText = reward ? escapeXml(reward) : '';

  return `
    <svg width="${dims.width}" height="${reward ? 120 : 100}" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="0" width="${dims.width - 80}" height="${reward ? 110 : 90}" rx="4" fill="${backgroundColor}"/>
      <text x="55" y="25" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1F2937">
        HOW TO HELP
      </text>
      <text x="55" y="48" font-family="Arial, sans-serif" font-size="12" fill="#374151">
        If you have any information, please contact:
      </text>
      <text x="55" y="75" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1F2937">
        ${emergency} | ${phone}
      </text>
      ${reward ? `
      <text x="55" y="100" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#DC2626">
        ${rewardText}
      </text>
      ` : ''}
    </svg>
  `;
}

export function generateFooterSvg(
  branding: PosterBranding,
  additionalText?: string,
): string {
  const orgName = escapeXml(branding.organizationName);
  const website = branding.website ? escapeXml(branding.website) : '';
  const extra = additionalText ? escapeXml(additionalText) : 'Generated by OpenJustice';

  return `
    <svg width="${dims.width}" height="60" xmlns="http://www.w3.org/2000/svg">
      <line x1="40" y1="5" x2="${dims.width - 40}" y2="5" stroke="#E5E7EB" stroke-width="1"/>
      <text x="${dims.width / 2}" y="30" font-family="Arial, sans-serif" font-size="11" fill="#6B7280" text-anchor="middle">
        ${orgName}${website ? ` | ${website}` : ''}
      </text>
      <text x="${dims.width / 2}" y="48" font-family="Arial, sans-serif" font-size="9" fill="#9CA3AF" text-anchor="middle">
        ${extra}
      </text>
    </svg>
  `;
}

export function generatePhotoPlaceholderSvg(
  width: number,
  height: number,
): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#E5E7EB"/>
      <text x="${width / 2}" y="${height / 2 - 10}" font-family="Arial, sans-serif" font-size="16" fill="#9CA3AF" text-anchor="middle">
        NO PHOTO
      </text>
      <text x="${width / 2}" y="${height / 2 + 15}" font-family="Arial, sans-serif" font-size="16" fill="#9CA3AF" text-anchor="middle">
        AVAILABLE
      </text>
    </svg>
  `;
}
