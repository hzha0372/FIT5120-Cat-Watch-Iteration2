<template>
  <div class="chart-wrapper">
    <div ref="chart"></div>
  </div>
</template>

<script>
import * as d3 from 'd3'
import { collection, getDocs } from 'firebase/firestore'
import db from '@/firebase/init'

export default {
  name: 'UserRoleChart',
  data() {
    return { processed: [] }
  },
  async mounted() {
    await this.loadData()
    this.draw()
  },
  methods: {
    async loadData() {
      const snap = await getDocs(collection(db, 'users'))
      const rows = snap.docs.map((d) => d.data())

      const byRole = d3.rollups(
        rows,
        (v) => v.length,
        (d) => d.role || 'Unknown',
      )

      this.processed = byRole
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => d3.descending(a.count, b.count))
    },

    draw() {
      const data = this.processed
      const margin = { top: 24, right: 16, bottom: 56, left: 48 }
      const width = 800
      const height = 400

      const svg = d3
        .select(this.$refs.chart)
        .append('svg')
        .attr('width', width)
        .attr('height', height)

      const inner = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
      const w = width - margin.left - margin.right
      const h = height - margin.top - margin.bottom

      const x = d3
        .scaleBand()
        .domain(data.map((d) => d.role))
        .range([0, w])
        .padding(0.2)
      const y = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.count) || 1])
        .nice()
        .range([h, 0])

      // tooltip
      const tip = d3
        .select(this.$refs.chart)
        .append('div')
        .style('position', 'absolute')
        .style('padding', '6px 8px')
        .style('background', 'rgba(0,0,0,.7)')
        .style('color', '#fff')
        .style('font-size', '12px')
        .style('border-radius', '6px')
        .style('pointer-events', 'none')
        .style('opacity', 0)

      inner
        .selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', (d) => x(d.role))
        .attr('width', x.bandwidth())
        .attr('y', h)
        .attr('height', 0)
        .on('mousemove', (e, d) => {
          tip
            .style('opacity', 1)
            .html(`<b>${d.role}</b><br/>Users: ${d.count}`)
            .style('left', e.offsetX + 12 + 'px')
            .style('top', e.offsetY - 10 + 'px')
        })
        .on('mouseleave', () => tip.style('opacity', 0))
        .transition()
        .duration(700)
        .attr('y', (d) => y(d.count))
        .attr('height', (d) => h - y(d.count))
        .attr('fill', '#00aaff')

      inner
        .append('g')
        .attr('transform', `translate(0,${h})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-30)')
        .style('text-anchor', 'end')
      inner.append('g').call(d3.axisLeft(y))
      inner
        .append('text')
        .attr('x', w / 2)
        .attr('y', -6)
        .attr('text-anchor', 'middle')
        .style('font-weight', 600)
        .text('User Count by Role')
    },
  },
}
</script>

<style scoped>
.chart-wrapper {
  max-width: 820px;
  margin: 24px auto;
  position: relative;
}
</style>
