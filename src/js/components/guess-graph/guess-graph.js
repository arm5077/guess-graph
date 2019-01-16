import { select, mouse } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { max, min, extent } from 'd3-array';
import { axisLeft, axisBottom } from 'd3-axis';
import { transition } from 'd3-transition';
import { line, curveCatmullRom } from 'd3-shape';
import 'typeface-roboto/index.css';
import style from './guess-graph.scss';

function preventScroll(e) {
  e.preventDefault();
  e.stopPropagation();
}

class GuessGraph extends HTMLElement {
  constructor() {
    super();
    this.margin = {
      top: 15,
      right: 40,
      bottom: 60,
      left: 55,
    };

    this.xAxisMargin = {
      left: 30,
      right: 20,
    };

    this.introTitle = this.getAttribute('intro-title');

    this.userPoints = [];
  }

  async connectedCallback() {
    console.log(this);
    this.addData();
  }

  async addData() {
    if (this.hasAttribute('data')) {
      await fetch(this.getAttribute('data'))
        .then(response => response.json())
        .then((body) => {
          this.data = body;
        });
    }

    this.data.sort((a, b) => a.year - b.year);
    this.userPoints = this.data.map((d, i) => {
      if (i === 0) {
        return {
          year: d.year,
          rate: d.rate,
        };
      }
      return {
        year: d.year,
        rate: null,
      };
    });
    this.finalYear = this.data[this.data.length - 1];
    this.drawElements();
  }

  async drawElements() {
    const chart = select(this)
      .append('div')
      .classed('guess-graph', true)
      .append('div')
      .classed('chart', true)
      .classed('dim', true);

    // Make title for chart
    chart.append('div')
      .attr('class', 'opener')
      .style('left', `${this.margin.left + 60 + 1}px`)
      .style('top', `${this.margin.top + 1}px`)
    .append('div')
      .classed('text', true)
      .html(this.introTitle);

    // Add SVG to chart
    const svg = select(this).select('.chart')
      .append('svg')
      .append('g')
        .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    // Make rect to capture SVG mouse moves
    svg.append('rect')
      .attr('class', 'mouseRect')
      .attr('x', 0)
      .attr('y', 0);

    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('class', 'label y-axis-label')
      .text(this.getAttribute('y-axis-label'));

    // Draw border
    svg.append('line')
      .attr('class', 'borderline bottom');

    svg.append('line')
      .attr('class', 'borderline top');

    svg.append('line')
      .attr('class', 'borderline left');

    svg.append('line')
      .attr('class', 'borderline right');

    svg.append('circle')
      .attr('class', 'dot first blinking')
      .attr('r', 10);

    // Add finish line
    svg.append('line')
      .attr('class', 'finishLine');

    chart.append('div')
      .classed('results-flag', true)
      .classed('hidden', true)
      .style('left', `${this.margin.left - 1}px`)
      .style('top', `${this.margin.top - 1}px`);

    this.x = scaleLinear();
    this.y = scaleLinear();

    ['x', 'y'].forEach((type) => {
      if (this.hasAttribute(`${type}-axis-min`) && this.hasAttribute(`${type}-axis-max`)) {
        this[type].domain([this.getAttribute(`${type}-axis-min`), this.getAttribute(`${type}-axis-max`)]);
      } else if (this.hasAttribute(`${type}-axis-ticks`)) {
        this[type].domain(extent(this.getAttribute(`${type}-axis-ticks`).split(',')));
      } else if (type === 'x') {
        this[type].domain(extent(this.data.map(d => d.year)));
      } else {
        this[type].domain(extent(this.data.map(d => d.rate)));
      }
    });

    svg.append('g')
      .attr('class', 'x axis desktop')
      .attr('transform', 'translate(0,0)');

    svg.append('g')
      .attr('class', 'y axis desktop');

    // Mobile version, if mobile ticks specified
    ['x','y'].forEach((axis) => {
      if (this.hasAttribute(`${axis}-axis-ticks-mobile`)) {
        svg.append('g')
          .attr('class', `${axis} axis mobile`)
          .attr('transform', 'translate(0,0)');
      }
    });

    this.sizeChart();
    this.addEvents();
  }

  sizeChart() {
    const chart = select(this)
      .select('.chart');

    if (this.hasAttribute('height')) {
      chart.style('height', `${this.getAttribute('height')}px`);
    }

    if (this.hasAttribute('height-mobile') && chart.node().offsetWidth <= 600) {
      chart.style('height', `${this.getAttribute('height-mobile')}px`);
    }

    this.width = chart.node().offsetWidth - this.margin.left - this.margin.right;
    this.height = chart.node().offsetHeight - this.margin.top - this.margin.bottom;

    // Now why, you might ask, am I substracting 2px from the width and height of this
    // here element? Tis simple: I want the .borderline borders to show and need to
    // substract a pixel from each side in order to have them fully render.
    chart.select('.opener')
      .style('height', `${this.height - 2}px`)
      .style('width', `${this.width - 80 - 2}px`);

    const svg = chart.select('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
    .select('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    svg.select('.mouseRect')
      .attr('width', this.width)
      .attr('height', this.height);

    chart.select('.y-axis-label')
      .attr('transform', `translate(-40, ${this.height / 2})rotate(-90)`);

    // Make scales for chart
      this.x.range([this.xAxisMargin.left, this.width - this.xAxisMargin.right]);
      this.y.range([this.height, 0]);

    this.yAxis = axisLeft()
      .scale(this.y)
      .tickPadding(5);

    this.xAxis = axisBottom()
      .scale(this.x)
      .tickFormat(d => `'${d.toString().slice(2, 4)}`)
      .tickSize(this.height)
      .tickPadding(10);

    if (this.getAttribute('x-axis-ticks')) {
      this.xAxis.tickValues(this.getAttribute('x-axis-ticks').split(','));
    }

    if (this.getAttribute('y-axis-ticks')) {
      this.yAxis.tickValues(this.getAttribute('y-axis-ticks').split(','));
    }

    // Draw/size axes
    svg.select('.x.axis.desktop')
      .call(this.xAxis);

  // Mobile version, if mobile ticks specified
    if (this.hasAttribute('x-axis-ticks-mobile')) {
       this.xAxis.tickValues(this.getAttribute('x-axis-ticks-mobile').split(','));
       svg.select('.x.axis.mobile')
         .call(this.xAxis);
    }

    svg.select('.y.axis')
      .call(this.yAxis);

    // Draw border
    svg.select('.borderline.bottom')
      .attr('x1', 0)
      .attr('x2', this.width)
      .attr('y1', this.height)
      .attr('y2', this.height);

    svg.select('.borderline.top')
      .attr('x1', 0)
      .attr('x2', this.width)
      .attr('y1', 0)
      .attr('y2', 0);

    svg.select('.borderline.left')
      .attr('x1', this.width)
      .attr('x2', this.width)
      .attr('y1', 0)
      .attr('y2', this.height);

    svg.select('.borderline.right')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', this.height);

    svg.select('.finishLine')
      .attr('y1', 0)
      .attr('y2', this.height);

    chart.select('.results-flag')
      .style('width', `${this.width + this.margin.right + 2}px`)
      .style('height', `${this.height + 2}px`);

    svg.select('.dot.first')
      .attr('cx', this.x(this.data[0].year))
      .attr('cy', this.y(this.data[0].rate));

    svg.select('.finishLine')
      .attr('x1', this.x(this.data[this.data.length - 1].year))
      .attr('x2', this.x(this.data[this.data.length - 1].year));

    if (this.finished) {
      this.drawDotsAndLine();
      this.addFinalLabels();
    }
  }

  async addEvents() {
    const firstPoint = select(this).select('.dot.first');

    window.addEventListener('resize', () => this.sizeChart());
    firstPoint.on('mousedown', () => this.pointerDown());
    firstPoint.on('touchstart', () => {
      this.addEventListener('touchmove', preventScroll, { passive: false });

      this.fadeIntro();
      this.pointerDown();
    });
    firstPoint.on('mouseover', () => this.fadeIntro());
  }

  pointerDown() {
    const firstPoint = select(this).select('.dot.first');
    const svg = select(this).select('svg').select('g');
    // Remove blinkiness of original dot
    firstPoint.classed('blinking', false);

    // Add blinkiness of finish line
    select(this).select('.finishLine').classed('blinking', true);

    // Event to capture mouse moves while button is held down
    svg.on('mousemove', () => this.pointerMove());
    svg.on('touchmove', () => this.pointerMove());

    select(this).on('mouseup', () => this.endItAll());
    select(this).on('touchend', () => {
      this.removeEventListener('touchmove', preventScroll, { passive: false });
      this.endItAll();
    });

    svg.on('mouseleave', () => this.pointerLeave());
    svg.on('touchleave', () => {
      this.removeEventListener('touchmove', preventScroll, { passive: false });
      this.pointerLeave();
    });
  }

  pointerMove() {
    const year = Math.floor(this.x.invert(mouse(this)[0] - this.margin.left));
    if (!this.finished
      && year >= min(this.data.map(d => d.year))
      && year <= max(this.data.map(d => d.year))) {
      // Get year represented by mouse position
      const yearObject = this.userPoints.find(d => d.year === year);
      if (yearObject.rate === null) {
        yearObject.rate = Math.max(this.y.invert(mouse(this)[1] - this.margin.top), 0);
      }
      this.fillMissingDots();
      this.isItOver();
      this.drawDotsAndLine();
    } // Done with !finshed part
  }

  pointerLeave() {
    // If the user jumped their mouse offscreen and to the right,
    // let's calculate what they WOULD have selected
    if (this.x.invert(mouse(this)[0] + this.margin.left) >= this.data[this.data.length - 1].year
      && !this.finished) {
      // Check if we skipped over any dates because we moved the mouse quickly
      // If we did, interpolate!!!!!
      this.userPoints[this.userPoints.length - 1]
        .rate = this.y.invert(mouse(this)[1] - this.margin.top);
      this.fillMissingDots();
      this.drawDotsAndLine();
      this.isItOver();
    }
    this.endItAll();
  }

  fadeIntro() {
    select(this).select('.opener').transition()
      .duration(250)
      .style('opacity', 0)
      .remove();

    select(this).select('.chart')
      .classed('dim', false);
  }

  drawDotsAndLine() {
    const svg = select(this).select('svg').select('g');
    // Build smaller array of points that have already been determined so we can build the line
    const lineData = this.userPoints.filter(d => d.rate !== null);

    if (!this.finished) {
      const mouseCoords = [mouse(this)[0] - this.margin.left, mouse(this)[1] - this.margin.top];
      if (mouseCoords[0] <= this.width) {
        lineData.push({
          year: this.x.invert(mouseCoords[0]),
          rate: this.y.invert(mouseCoords[1]),
        });
      }
    }

    lineData[0] = {
      year: this.data[0].year,
      rate: this.data[0].rate,
    };

    this.lineFunction = line()
      .x(d => this.x(d.year))
      .y(d => this.y(d.rate))
      .curve(curveCatmullRom.alpha(0.5));
      console.log(this.x(1999));
    // Draw the line
    // svg.select('.userLine').remove();
    if (!svg.select('.userLine')[0]) {
      svg.append('path')
        .attr('class', 'userLine');
    }

    svg.select('.userLine')
      .datum(lineData)
      .attr('d', this.lineFunction);

    // Add dots
    svg.selectAll('.dot')
      .data(this.userPoints.filter(d => d.rate != null))
    .enter().append('circle')
      .attr('class', 'dot');

    svg.selectAll('.dot')
     .attr('r', 7)
     .attr('cx', d => this.x(d.year))
     .attr('cy', d => this.y(d.rate));

    // If finished, redraw final line
    svg.select('.realLine')
      .datum(this.data)
     .attr('d', this.lineFunction);
  }

  fillMissingDots() {
    // Check if we skipped over any dates because we moved the mouse quickly
    // If we did, interpolate!!!!!
    const filledPoints = this.userPoints.filter(d => d.rate !== null);
    const lastYear = filledPoints[filledPoints.length - 1].year;

    // Find years that are null before last year with data
    this.userPoints.filter(d => d.year < lastYear && d.rate == null).forEach((d) => {
      // Get first year with data before null year
      const year0 = filledPoints.filter(f => f.year < d.year).sort((a, b) => b.year - a.year)[0];
      const year1 = filledPoints.filter(f => f.year > d.year).sort((a, b) => a.year - b.year)[0];

      const rateDelta = year1.rate - year0.rate;
      const yearDelta = year1.year - year0.year;
      this.userPoints.find(f => f.year === d.year)
        .rate = year0.rate + (rateDelta * ((d.year - year0.year) / yearDelta));
    });
  }

  isItOver() {
    const svg = select(this).select('svg');
    // Is this all over? Then let's finalize
    if (!this.userPoints.find(d => d.rate === null)
      && this.userPoints.length === this.data.length) {
        this.finished = true;
        svg.select('.finishLine').classed('blinking', false);
        svg.selectAll('.dot:not(.first)').classed('hidden', true);
        this.drawDotsAndLine();
        this.calculateError();
        this.addFinalLabels();

        if (this.getAttribute('result-message') === 'true') {
          setTimeout(() => {
            select(this).select('.results-flag')
              .classed('hidden', false);
          }, 2500);
        }
        return true;
    }
    return false;
  }

  addFinalLabels() {
    const svg = select(this).select('svg').select('g');
    if (!svg.select('.in-chart-label.guess')[0]) {
      svg.append('text')
        .attr('class', 'in-chart-label guess');
    }

    svg.select('.in-chart-label.guess')
      .attr('text-anchor', 'right')
      .attr('transform', `translate(${this.x(this.finalYear.year) + 12}, ${this.y(this.userPoints[this.userPoints.length - 1].rate) + 5})`)
      .text('Guess')
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1);

      setTimeout(() => {
        if (!svg.select('.realLine')[0]) {
          svg.append('path')
            .attr('class', 'realLine');
        }

        svg.select('.realLine')
          .datum(this.data)
          .attr('d', this.lineFunction)
          .style('opacity', 0)
          .transition()
          .duration(500)
          .style('opacity', 1);

        if (!svg.select('.in-chart-label.real')[0]) {
          svg.append('text')
            .attr('class', 'in-chart-label real');
        }

        svg.select('.in-chart-label.real')
          .attr('text-anchor', 'right')
          .attr('transform', `translate(${this.x(this.finalYear.year) + 5}, ${this.y(this.data[this.data.length - 1].rate) + 5})`)
          .text('Real')
          .style('opacity', 0)
          .transition()
          .duration(500)
          .style('opacity', 1);
      }, 1000);
  }

  endItAll() {
    const chart = select(this).select('.chart');
    const svg = chart.select('svg').select('g');

    svg.on('mouseleave', null);
    select(this).on('mouseup', null);
    select(this).on('touchend', null);
    svg.on('mousemove', null);
    svg.on('touchmove', null);
    if (!this.finished) {
      chart.select('.finishLine').classed('blinking', false);
      chart.select('.userLine').classed('hidden', true);
      chart.selectAll('.dot:not(.first)').classed('hidden', true);
      setTimeout(() => {
        chart.select('.dot.first').classed('blinking', true);
        chart.select('.userLine').remove();
        chart.selectAll('.dot:not(.first)').remove();
        this.userPoints = this.userPoints.map((d) => {
          if (d.year === this.data[0].year) {
            return {
              year: d.year,
              rate: d.rate,
            };
          }
          return {
            year: d.year,
            rate: null,
          };
        });
      }, 500);
    }
  }

  calculateError() {
    let totalError = 0;
    this.data.forEach((actual) => {
      const guess = this.userPoints.find(d => d.year === actual.year);
      totalError += Math.abs((guess.rate - actual.rate) / actual.rate);
    });
    totalError /= this.data.length;
    totalError *= 100;
    totalError = Math.round(totalError);
    const resultsFlag = select(this).select('.results-flag');

    if (totalError <= 10) {
      resultsFlag.classed('green', true)
        .text(`Good job — you were only ${totalError} percent off!`);
    } else if (totalError <= 30) {
      resultsFlag.classed('orange', true)
        .text(`Not bad — you were ${totalError} percent off.`);
    } else {
      resultsFlag.classed('red', true)
        .text(`You were ${totalError} percent off.`);
    }
  }
}

export default window.customElements.define('guess-graph', GuessGraph);
