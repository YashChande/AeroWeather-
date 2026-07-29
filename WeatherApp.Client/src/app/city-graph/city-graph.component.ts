import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, AfterViewInit,
  ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeatherRecord } from '../weather.service';
import * as d3 from 'd3';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  record: WeatherRecord;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode;
  target: GraphNode;
}

@Component({
  selector: 'app-city-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './city-graph.component.html',
  styleUrl: './city-graph.component.css'
})
export class CityGraphComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() cities: WeatherRecord[] = [];
  @Output() nodeHovered = new EventEmitter<WeatherRecord | null>();
  @Output() nodeClicked = new EventEmitter<WeatherRecord>();

  @ViewChild('svgContainer') svgContainer!: ElementRef;

  hoveredCity: WeatherRecord | null = null;
  private simulation!: d3.Simulation<GraphNode, GraphLink>;
  private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private resizeObserver!: ResizeObserver;

  ngAfterViewInit() {
    this.buildGraph();
    this.resizeObserver = new ResizeObserver(() => this.buildGraph());
    this.resizeObserver.observe(this.svgContainer.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cities'] && !changes['cities'].firstChange && this.svgContainer) {
      this.buildGraph();
    }
  }

  ngOnDestroy() {
    this.simulation?.stop();
    this.resizeObserver?.disconnect();
  }

  private buildGraph() {
    if (!this.svgContainer || this.cities.length === 0) return;

    const container = this.svgContainer.nativeElement as HTMLElement;
    const W = window.innerWidth;
    const H = window.innerHeight - 180;

    // Clear previous
    d3.select(container).selectAll('*').remove();

    const nodes: GraphNode[] = this.cities.map(c => ({
      id: c.location,
      record: c,
      x: W / 2 + (Math.random() - 0.5) * (W * 0.5),
      y: H / 2 + (Math.random() - 0.5) * (H * 0.4)
    }));

    // Full mesh links
    const links: GraphLink[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        links.push({ source: nodes[i], target: nodes[j] } as GraphLink);
      }
    }

    this.svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('pointer-events', 'none')  // SVG background transparent; nodes override
      .style('overflow', 'visible');

    // Glowing filter
    const defs = this.svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '6').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Pulse ring gradient
    const radGrad = defs.append('radialGradient').attr('id', 'nodeGrad');
    radGrad.append('stop').attr('offset', '0%').attr('stop-color', '#c084fc');
    radGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', '0');

    // Links
    const link = this.svg.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(168,85,247,0.35)')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6 6');

    // Node groups
    const node = (this.svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g') as any)
      .attr('class', 'graph-node')
      .style('cursor', 'grab')
      .style('pointer-events', 'all')  // explicitly enable interaction
      .style('touch-action', 'none')   // required for drag on touch/mobile
      .on('mouseenter', (_: any, d: GraphNode) => {
        this.hoveredCity = d.record;
        this.nodeHovered.emit(d.record);
      })
      .on('mouseleave', () => {
        this.hoveredCity = null;
        this.nodeHovered.emit(null);
      })
      .on('click', (_: any, d: GraphNode) => {
        this.nodeClicked.emit(d.record);
      })
      .call((d3.drag<SVGGElement, GraphNode>() as any)
        .on('start', (event: any, d: GraphNode) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: GraphNode) => {
          d.fx = Math.max(70, Math.min(W - 70, event.x));
          d.fy = Math.max(70, Math.min(H - 70, event.y));
          d.x = d.fx;
          d.y = d.fy;
        })
        .on('end', (event: any, d: GraphNode) => {
          if (!event.active) this.simulation.alphaTarget(0);
          // Keep node pinned at dragged position
          d.fx = d.x;
          d.fy = d.y;
        })
      ) as d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown>;

    // Outer pulse ring (200% larger: r = 72)
    node.append('circle')
      .attr('r', 72)
      .attr('fill', 'url(#nodeGrad)')
      .attr('opacity', 0.6)
      .attr('class', 'pulse-ring');

    // Main Node circle (200% larger: r = 56)
    node.append('circle')
      .attr('r', 56)
      .attr('fill', 'rgba(12, 10, 36, 0.92)')
      .attr('stroke', '#c084fc')
      .attr('stroke-width', 3.5)
      .attr('filter', 'url(#glow)');

    // Weather emoji (200% larger: size 40)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', -12)
      .attr('font-size', '38')
      .text(d => this.getWeatherIcon(d.record.condition, d.record.isDay));

    // Temperature text (200% larger: size 20)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('y', 26)
      .attr('fill', 'white')
      .attr('font-size', '20')
      .attr('font-weight', '800')
      .attr('font-family', 'Outfit, sans-serif')
      .text(d => `${Math.round(d.record.temperature)}°C`);

    // City name label below node (200% larger: size 20)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 88)
      .attr('fill', 'rgba(255,255,255,0.95)')
      .attr('font-size', '20')
      .attr('font-weight', '700')
      .attr('font-family', 'Outfit, sans-serif')
      .attr('filter', 'url(#glow)')
      .text(d => d.record.location);

    // Simulation
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(220).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(90))
      .on('tick', () => {
        link
          .attr('x1', d => (d.source as GraphNode).x!)
          .attr('y1', d => (d.source as GraphNode).y!)
          .attr('x2', d => (d.target as GraphNode).x!)
          .attr('y2', d => (d.target as GraphNode).y!);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    // Animate pulse rings
    const animatePulse = () => {
      this.svg.selectAll<SVGCircleElement, GraphNode>('.pulse-ring')
        .transition()
        .duration(2000)
        .ease(d3.easeSinInOut)
        .attr('r', 84)
        .attr('opacity', 0)
        .transition()
        .duration(0)
        .attr('r', 56)
        .attr('opacity', 0.6)
        .on('end', animatePulse);
    };
    animatePulse();
  }

  getWeatherIcon(condition: string, isDay: boolean): string {
    const c = condition.toLowerCase();
    if (c.includes('clear')) return isDay ? '☀️' : '🌙';
    if (c.includes('cloud')) return isDay ? '⛅' : '☁️';
    if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('fog')) return '🌫️';
    return '🌡️';
  }
}
