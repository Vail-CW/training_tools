import { store } from '../state/store';
import { THRESHOLDS, getPerformanceLevel } from '../core/weighted-average';
import { getCharDisplayName } from '../data/morse-codes';
import type { HistoryState, WordHistoryState, CallsignHistoryState } from '../types';

export type ChartDataSource = 'individual' | 'word' | 'callsign';

// Chart colors matching CSS variables
const COLORS = {
  background: '#12121a',
  gridLine: 'rgba(255, 255, 255, 0.1)',
  text: '#888',
  green: '#00d26a',
  yellow: '#ffc107',
  red: '#ff4757',
  dot: '#1a1a2e',
  dotBorder: '#f0f0f0',
};

// Chart configuration
const CONFIG = {
  paddingTop: 30,
  paddingBottom: 30,
  paddingLeft: 50,
  paddingRight: 10,
  minBarGap: 1,
  maxBarGap: 4,
  minBarWidth: 4,
  maxBarWidth: 25,
  minDotRadius: 2,
  maxDotRadius: 4,
  yAxisMin: 100,
  yAxisMax: 5000,
};

export class ProgressChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tooltip: HTMLDivElement | null = null;
  private dataSource: ChartDataSource = 'individual';

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.setupCanvas();
    this.setupEventListeners();
    this.render();

    // Subscribe to history changes
    store.subscribe('history', () => {
      if (this.dataSource === 'individual') this.render();
    });
    store.subscribe('wordHistory', () => {
      if (this.dataSource === 'word') this.render();
    });
    store.subscribe('callsignHistory', () => {
      if (this.dataSource === 'callsign') this.render();
    });
    store.subscribe('characterSet', () => this.render());

    // Handle resize
    window.addEventListener('resize', () => {
      this.render();
    });
  }

  setDataSource(source: ChartDataSource): void {
    if (this.dataSource !== source) {
      this.dataSource = source;
      this.render();
    }
  }

  getDataSource(): ChartDataSource {
    return this.dataSource;
  }

  private getHistory(): HistoryState | WordHistoryState | CallsignHistoryState {
    if (this.dataSource === 'individual') return store.getHistory();
    if (this.dataSource === 'word') return store.getWordHistory();
    return store.getCallsignHistory();
  }

  private setupCanvas(): void {
    const container = this.canvas.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Always fit to container width - bars will scale to fit
    const canvasWidth = containerRect.width;
    const canvasHeight = containerRect.height;

    this.canvas.width = canvasWidth * dpr;
    this.canvas.height = canvasHeight * dpr;
    this.ctx.scale(dpr, dpr);

    // Set canvas CSS size
    this.canvas.style.width = `${canvasWidth}px`;
    this.canvas.style.height = `${canvasHeight}px`;
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
    this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.checkHover(x, y);
  }

  private handleTouch(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.checkHover(x, y);
  }

  // Calculate bar dimensions that fit all characters on screen
  private getBarDimensions(chartWidth: number, numChars: number): { barWidth: number; barGap: number; startX: number; dotRadius: number } {
    if (numChars === 0) {
      return { barWidth: 0, barGap: 0, startX: CONFIG.paddingLeft, dotRadius: CONFIG.maxDotRadius };
    }

    // Calculate the bar width to fit all bars in available space
    // Total space = numChars * barWidth + (numChars - 1) * barGap
    // We want barGap to be proportional to barWidth
    const gapRatio = 0.2; // gap is 20% of bar width
    // chartWidth = numChars * barWidth + (numChars - 1) * barWidth * gapRatio
    // chartWidth = barWidth * (numChars + (numChars - 1) * gapRatio)
    const denominator = numChars + (numChars - 1) * gapRatio;
    let barWidth = chartWidth / denominator;

    // Clamp bar width
    barWidth = Math.min(CONFIG.maxBarWidth, Math.max(CONFIG.minBarWidth, barWidth));

    // Calculate gap based on bar width
    let barGap = barWidth * gapRatio;
    barGap = Math.min(CONFIG.maxBarGap, Math.max(CONFIG.minBarGap, barGap));

    // Calculate starting X to center the bars
    const totalBarsWidth = numChars * barWidth + (numChars - 1) * barGap;
    const startX = CONFIG.paddingLeft + Math.max(0, (chartWidth - totalBarsWidth) / 2);

    // Scale dot radius with bar width
    const dotRadius = Math.min(CONFIG.maxDotRadius, Math.max(CONFIG.minDotRadius, barWidth / 4));

    return { barWidth, barGap, startX, dotRadius };
  }

  private checkHover(mouseX: number, _mouseY: number): void {
    const activeChars = store.getActiveCharacters();
    const history = this.getHistory();

    const canvasWidth = parseFloat(this.canvas.style.width) || this.canvas.getBoundingClientRect().width;
    const chartWidth = canvasWidth - CONFIG.paddingLeft - CONFIG.paddingRight;
    const { barWidth, barGap, startX } = this.getBarDimensions(chartWidth, activeChars.length);

    for (let i = 0; i < activeChars.length; i++) {
      const char = activeChars[i];
      const x = startX + i * (barWidth + barGap);

      if (mouseX >= x && mouseX <= x + barWidth) {
        const charHistory = history[char];
        const wma = charHistory?.wma ?? 5000;
        const mostRecent = charHistory?.mostRecent ?? 5000;

        this.showTooltip(
          char,
          wma,
          mostRecent,
          x + barWidth / 2,
          CONFIG.paddingTop
        );
        return;
      }
    }

    this.hideTooltip();
  }

  private showTooltip(char: string, wma: number, mostRecent: number, x: number, y: number): void {
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.style.cssText = `
        position: absolute;
        background: rgba(18, 18, 26, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        color: #f0f0f0;
        pointer-events: none;
        z-index: 100;
        backdrop-filter: blur(10px);
        white-space: nowrap;
      `;
      this.canvas.parentElement?.appendChild(this.tooltip);
    }

    const displayChar = getCharDisplayName(char);
    this.tooltip.innerHTML = `
      <strong>${displayChar}</strong><br>
      WMA: ${Math.round(wma)}ms<br>
      Recent: ${Math.round(mostRecent)}ms
    `;

    this.tooltip.style.left = `${x}px`;
    this.tooltip.style.top = `${y - 70}px`;
    this.tooltip.style.display = 'block';
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
  }

  // Convert value to Y position (logarithmic scale)
  private valueToY(value: number, chartHeight: number): number {
    const logMin = Math.log10(CONFIG.yAxisMin);
    const logMax = Math.log10(CONFIG.yAxisMax);
    const logValue = Math.log10(Math.max(CONFIG.yAxisMin, Math.min(CONFIG.yAxisMax, value)));

    const ratio = (logValue - logMin) / (logMax - logMin);
    return CONFIG.paddingTop + chartHeight * (1 - ratio);
  }

  render(): void {
    // Recalculate canvas size based on characters
    this.setupCanvas();

    const width = parseFloat(this.canvas.style.width);
    const height = parseFloat(this.canvas.style.height);
    const chartHeight = height - CONFIG.paddingTop - CONFIG.paddingBottom;
    const chartWidth = width - CONFIG.paddingLeft - CONFIG.paddingRight;

    // Clear canvas
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, width, height);

    const activeChars = store.getActiveCharacters();
    const history = this.getHistory();

    if (activeChars.length === 0) {
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = '14px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('No characters selected', width / 2, height / 2);
      return;
    }

    // Check if history is empty for non-individual modes
    if (this.dataSource === 'word' && Object.keys(history).length === 0) {
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = '14px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('No word practice history yet', width / 2, height / 2);
      return;
    }
    if (this.dataSource === 'callsign' && Object.keys(history).length === 0) {
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = '14px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('No callsign practice history yet', width / 2, height / 2);
      return;
    }

    // Calculate bar dimensions - fit all bars in available space
    const { barWidth, barGap, startX, dotRadius } = this.getBarDimensions(chartWidth, activeChars.length);

    // Draw bars first (so other elements render on top)
    for (let i = 0; i < activeChars.length; i++) {
      const char = activeChars[i];
      const x = startX + i * (barWidth + barGap);
      const charHistory = history[char];
      const wma = charHistory?.wma ?? 5000;
      const mostRecent = charHistory?.mostRecent ?? 5000;

      // Draw bar (WMA)
      const barY = this.valueToY(wma, chartHeight);
      const barHeight = height - CONFIG.paddingBottom - barY;

      const level = getPerformanceLevel(wma);
      this.ctx.fillStyle =
        level === 'icr' ? COLORS.green : level === 'cr' ? COLORS.yellow : COLORS.red;

      // Use smaller corner radius for thin bars
      const cornerRadius = Math.min(3, barWidth / 3);
      this.ctx.beginPath();
      this.ctx.roundRect(x, barY, barWidth, barHeight, [cornerRadius, cornerRadius, 0, 0]);
      this.ctx.fill();

      // Draw dot (most recent) - scale with bar size
      const dotY = this.valueToY(mostRecent, chartHeight);
      this.ctx.beginPath();
      this.ctx.arc(x + barWidth / 2, dotY, dotRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = COLORS.dot;
      this.ctx.fill();
      this.ctx.strokeStyle = COLORS.dotBorder;
      this.ctx.lineWidth = Math.max(1, dotRadius / 2);
      this.ctx.stroke();

      // Draw character label (only if bars are wide enough)
      if (barWidth >= 6) {
        this.ctx.fillStyle = COLORS.text;
        const fontSize = Math.max(6, Math.min(10, barWidth - 1));
        this.ctx.font = `${fontSize}px monospace`;
        this.ctx.textAlign = 'center';
        const displayChar = getCharDisplayName(char);
        // Show single char for narrow bars
        const label = barWidth < 12 ? displayChar.charAt(0) : (displayChar.length > 3 ? displayChar.substring(0, 2) : displayChar);
        this.ctx.fillText(label, x + barWidth / 2, height - CONFIG.paddingBottom + fontSize + 2);
      }
    }

    // Draw Y-axis background to cover any overlapping bars
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, CONFIG.paddingLeft - 5, height);

    // Draw threshold lines ON TOP of bars
    this.drawThresholdLines(chartHeight, width);

    // Draw Y-axis labels ON TOP of bars
    this.drawYAxis(chartHeight);
  }

  private drawThresholdLines(chartHeight: number, width: number): void {
    // ICR threshold (600ms) - green
    const icrY = this.valueToY(THRESHOLDS.ICR, chartHeight);
    this.ctx.strokeStyle = COLORS.green;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(CONFIG.paddingLeft, icrY);
    this.ctx.lineTo(width - CONFIG.paddingRight, icrY);
    this.ctx.stroke();

    // CR threshold (2000ms) - yellow
    const crY = this.valueToY(THRESHOLDS.CR, chartHeight);
    this.ctx.strokeStyle = COLORS.yellow;
    this.ctx.beginPath();
    this.ctx.moveTo(CONFIG.paddingLeft, crY);
    this.ctx.lineTo(width - CONFIG.paddingRight, crY);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  private drawYAxis(chartHeight: number): void {
    const labels = [100, 300, 600, 1000, 2000, 5000];

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '10px system-ui';
    this.ctx.textAlign = 'right';

    for (const value of labels) {
      const y = this.valueToY(value, chartHeight);
      this.ctx.fillText(`${value}`, CONFIG.paddingLeft - 8, y + 3);

      // Grid line
      this.ctx.strokeStyle = COLORS.gridLine;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(CONFIG.paddingLeft, y);
      this.ctx.lineTo(CONFIG.paddingLeft + 5, y);
      this.ctx.stroke();
    }
  }
}
