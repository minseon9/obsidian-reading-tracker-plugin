/**
 * Chart Renderer Component
 * Renders bar and line charts for statistics visualization
 */

import { formatDate } from '../../utils/dateUtils';

export interface ChartDataPoint {
	label: string;
	value: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_HEIGHT = 200;
const VIEW_WIDTH = 600;
const PADDING = 40;
const Y_AXIS_STEPS = 5;
const HEATMAP_WEEKS = 52;
const DAYS_PER_WEEK = 7;

export class ChartRenderer {
	/**
	 * Render a 52-week reading activity heatmap (GitHub / Bookmory style).
	 */
	static renderActivityHeatmap(
		container: HTMLElement,
		doc: Document,
		dailyActivity: Record<string, number>
	): void {
		const wrapper = doc.createElement('div');
		wrapper.className = 'reading-tracker-heatmap-wrapper';

		const grid = doc.createElement('div');
		grid.className = 'reading-tracker-heatmap-grid';

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const dayOfWeek = today.getDay(); // 0 (Sun) .. 6 (Sat)
		const totalCells = (HEATMAP_WEEKS - 1) * DAYS_PER_WEEK + dayOfWeek + 1;
		const startDate = new Date(today);
		startDate.setDate(today.getDate() - (totalCells - 1));

		for (let i = 0; i < totalCells; i++) {
			const cellDate = new Date(startDate);
			cellDate.setDate(startDate.getDate() + i);
			const key = formatDate(cellDate);
			const count = dailyActivity[key] ?? 0;
			const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;

			const cell = doc.createElement('div');
			cell.className = `reading-tracker-heatmap-cell is-level-${level}`;
			cell.title = count > 0
				? `${key} — read ${count} ${count === 1 ? 'book' : 'books'}`
				: `${key} — no reading recorded`;
			grid.appendChild(cell);
		}

		wrapper.appendChild(grid);

		const legend = doc.createElement('div');
		legend.className = 'reading-tracker-heatmap-legend';
		const less = doc.createElement('span');
		less.textContent = 'Less';
		legend.appendChild(less);

		for (let level = 0; level <= 3; level++) {
			const sample = doc.createElement('span');
			sample.className = `reading-tracker-heatmap-cell is-level-${level}`;
			legend.appendChild(sample);
		}

		const more = doc.createElement('span');
		more.textContent = 'More';
		legend.appendChild(more);
		wrapper.appendChild(legend);

		container.appendChild(wrapper);
	}

	/**
	 * Render a bar chart
	 */
	static renderBarChart(
		container: HTMLElement,
		doc: Document,
		data: ChartDataPoint[]
	): void {
		if (data.length === 0) {
			this.renderEmptyChart(container, doc, 'Category');
			return;
		}

		const maxValue = Math.max(...data.map(d => d.value));

		data.forEach(item => {
			const barContainer = doc.createElement('div');
			barContainer.setCssProps({
				"margin-bottom": "12px"
			});

			const labelRow = doc.createElement('div');
			labelRow.setCssProps({
				display: "flex",
				"justify-content": "space-between",
				"align-items": "center",
				"margin-bottom": "4px"
			});

			const label = doc.createElement('span');
			label.textContent = item.label;
			label.setCssProps({
				"font-size": "12px",
				color: "var(--text-normal)"
			});

			const value = doc.createElement('span');
			value.textContent = item.value.toString();
			value.setCssProps({
				"font-size": "12px",
				"font-weight": "600",
				color: "var(--text-accent)"
			});

			labelRow.appendChild(label);
			labelRow.appendChild(value);

			const barBg = doc.createElement('div');
			barBg.setCssProps({
				width: "100%",
				height: "8px",
				"background-color": "var(--background-modifier-border)",
				"border-radius": "4px",
				overflow: "hidden"
			});

			const barFill = doc.createElement('div');
			const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
			barFill.setCssProps({
				width: `${percentage}%`,
				height: "100%",
				"background-color": "var(--interactive-accent)",
				transition: "width 0.3s"
			});

			barBg.appendChild(barFill);
			barContainer.appendChild(labelRow);
			barContainer.appendChild(barBg);
			container.appendChild(barContainer);
		});
	}

	/**
	 * Render a line chart showing variation over time (newest-first input is reversed to chronological left-to-right).
	 */
	static renderLineChart(
		container: HTMLElement,
		doc: Document,
		data: ChartDataPoint[],
		xAxisLabel: string
	): void {
		if (data.length === 0) {
			this.renderEmptyChart(container, doc, xAxisLabel);
			return;
		}

		const chronologicalData = [...data].reverse();
		const maxValue = Math.max(...chronologicalData.map(d => d.value), 1);
		const plotWidth = VIEW_WIDTH - PADDING * 2;
		const plotHeight = CHART_HEIGHT - PADDING * 2;

		const svg = doc.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', `${CHART_HEIGHT}px`);
		svg.setAttribute('viewBox', `0 0 ${VIEW_WIDTH} ${CHART_HEIGHT}`);
		svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		(svg as unknown as HTMLElement).setCssProps({ display: "block" });

		ChartRenderer.renderGridAndYAxis(svg, doc, maxValue, plotWidth, plotHeight);

		const coordinates = chronologicalData.map((item, index) => {
			const x = PADDING + (index / (chronologicalData.length - 1 || 1)) * plotWidth;
			const y = PADDING + plotHeight - (item.value / maxValue) * plotHeight;
			return { x, y, item };
		});

		if (coordinates.length > 1) {
			const path = doc.createElementNS(SVG_NS, 'path');
			const pointsAttr = coordinates.map(({ x, y }) => `${x},${y}`).join(' L ');
			path.setAttribute('d', `M ${pointsAttr}`);
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', 'var(--interactive-accent)');
			path.setAttribute('stroke-width', '2');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			svg.appendChild(path);
		}

		for (const { x, y, item } of coordinates) {
			ChartRenderer.renderDataPoint(svg, doc, x, y, item);
		}

		container.appendChild(svg);
	}

	private static renderGridAndYAxis(
		svg: SVGSVGElement,
		doc: Document,
		maxValue: number,
		plotWidth: number,
		plotHeight: number
	): void {
		for (let i = 0; i <= Y_AXIS_STEPS; i++) {
			const value = (maxValue / Y_AXIS_STEPS) * i;
			const y = PADDING + plotHeight - (i / Y_AXIS_STEPS) * plotHeight;

			const gridLine = doc.createElementNS(SVG_NS, 'line');
			gridLine.setAttribute('x1', PADDING.toString());
			gridLine.setAttribute('y1', y.toString());
			gridLine.setAttribute('x2', (PADDING + plotWidth).toString());
			gridLine.setAttribute('y2', y.toString());
			gridLine.setAttribute('stroke', 'var(--background-modifier-border)');
			gridLine.setAttribute('stroke-width', '1');
			gridLine.setAttribute('stroke-dasharray', '2,2');
			svg.appendChild(gridLine);

			const yLabel = doc.createElementNS(SVG_NS, 'text');
			yLabel.setAttribute('x', (PADDING - 5).toString());
			yLabel.setAttribute('y', (y + 4).toString());
			yLabel.setAttribute('text-anchor', 'end');
			yLabel.setAttribute('font-size', '9');
			yLabel.setAttribute('fill', 'var(--text-muted)');
			yLabel.textContent = Math.round(value).toString();
			svg.appendChild(yLabel);
		}
	}

	private static renderDataPoint(
		svg: SVGSVGElement,
		doc: Document,
		x: number,
		y: number,
		item: ChartDataPoint
	): void {
		const circle = doc.createElementNS(SVG_NS, 'circle');
		circle.setAttribute('cx', x.toString());
		circle.setAttribute('cy', y.toString());
		circle.setAttribute('r', '4');
		circle.setAttribute('fill', 'var(--interactive-accent)');
		svg.appendChild(circle);

		if (item.value > 0) {
			const text = doc.createElementNS(SVG_NS, 'text');
			text.setAttribute('x', x.toString());
			text.setAttribute('y', (y - 10).toString());
			text.setAttribute('text-anchor', 'middle');
			text.setAttribute('font-size', '11');
			text.setAttribute('fill', 'var(--text-normal)');
			text.setAttribute('font-weight', '600');
			text.textContent = item.value.toString();
			svg.appendChild(text);
		}

		const label = doc.createElementNS(SVG_NS, 'text');
		label.setAttribute('x', x.toString());
		label.setAttribute('y', (CHART_HEIGHT - 10).toString());
		label.setAttribute('text-anchor', 'middle');
		label.setAttribute('font-size', '9');
		label.setAttribute('fill', 'var(--text-muted)');
		label.textContent = item.label.length > 8 ? `${item.label.substring(0, 8)}...` : item.label;
		svg.appendChild(label);
	}

	/**
	 * Render empty chart placeholder
	 */
	static renderEmptyChart(
		container: HTMLElement,
		doc: Document,
		xAxisLabel: string
	): void {
		const emptyState = doc.createElement('div');
		emptyState.setCssProps({
			display: "flex",
			"flex-direction": "column",
			"align-items": "center",
			"justify-content": "center",
			height: "200px",
			color: "var(--text-muted)"
		});

		const text = doc.createElement('div');
		const axisLabel = xAxisLabel.toLowerCase();
		text.textContent = axisLabel ? `No ${axisLabel} data yet` : 'No data yet';
		text.setCssProps({
			"font-size": "13px"
		});

		emptyState.appendChild(text);
		container.appendChild(emptyState);
	}
}
