// --- HELPER: Convert string to valid CSS class ---
function toSafeID(str) {
	return str.replace(/[^a-zA-Z0-9]/g, '-');
}

// --- CONFIG ---
const nameMapping = {
	"United States of America": "United States of America",
	"China": "China", "India": "India", "Indonesia": "Indonesia", "Philippines": "Philippines",
	"Japan": "Japan", "Mexico": "Mexico", "Brazil": "Brazil", "Turkey": "Turkey", "Chile": "Chile",
	"Canada": "Canada", "Australia": "Australia", "France": "France", "Germany": "Germany",
	"Italy": "Italy", "Spain": "Spain", "Greece": "Greece", "Nigeria": "Nigeria",
	"Bangladesh": "Bangladesh", "South Africa": "South Africa"
};

let rawData = [];
let worldData = null;
let rangeYears = [2018, 2024];

// --- INIT ---
Promise.all([
	d3.csv("data.csv"),
	d3.json("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
]).then(([csv, world]) => {

	const parser = d3.timeParse("%Y-%m-%d");
	rawData = csv.map(d => ({
		date: parser(d.date),
		year: parser(d.date) ? parser(d.date).getFullYear() : 0,
		country: d.country,
		mapName: nameMapping[d.country] || d.country,
		type: d.disaster_type,
		severity: +d.severity_index,
		efficiency: +d.response_efficiency_score,
		casualties: +d.casualties || 0,
		time: +d.response_time_hours,
		loss: +d.economic_loss_usd,
		aid: +d.aid_amount_usd || 0,
		lat: +d.latitude,
		lng: +d.longitude
	})).filter(d => d.date && !isNaN(d.lat));

	worldData = world;

	initCheckboxList("#country-list", [...new Set(rawData.map(d => d.country))].sort());
	initCheckboxList("#type-list", [...new Set(rawData.map(d => d.type))].sort());
	initSlider();
	updateDashboard();

	d3.select("#resetBtn").on("click", resetAll);
	window.addEventListener("resize", () => { setTimeout(updateDashboard, 300); });
});

// --- HELPER: Create Checkboxes with Smart Select All ---
function initCheckboxList(containerId, items) {
	const container = d3.select(containerId);
	container.html("");

	// 1. Add "Select All" Option
	const selectAllLabel = container.append("label")
		.attr("class", "checkbox-item")
		.style("border-bottom", "1px solid #546e7a")
		.style("margin-bottom", "5px")
		.style("padding-bottom", "5px");

	const selectAllCheckbox = selectAllLabel.append("input")
		.attr("type", "checkbox")
		.attr("class", "select-all")
		.on("change", function () {
			const checked = d3.select(this).property("checked");

			container.selectAll("label:not([style*='display: none']) input:not(.select-all)")
				.property("checked", checked);

			updateDashboard();
		});

	selectAllLabel.append("span")
		.text("Select All / Clear All")
		.style("font-weight", "bold")
		.style("color", "#4fc3f7");

	// 2. Add individual items
	items.forEach(item => {
		const label = container.append("label").attr("class", "checkbox-item");
		label.append("input")
			.attr("type", "checkbox")
			.attr("value", item)
			.on("change", function () {
				updateDashboard();

				// Check status logic 
				const visibleInputs = container.selectAll("label:not([style*='display: none']) input:not(.select-all)");
				const allCount = visibleInputs.size();
				const checkedCount = visibleInputs.filter(":checked").size();

				selectAllCheckbox.property("checked", allCount > 0 && allCount === checkedCount);
				selectAllCheckbox.property("indeterminate", checkedCount > 0 && checkedCount < allCount);
			});

		label.append("span").text(item);
	});

	// default: mark all items checked (so global view starts as 'all selected')
	container.selectAll("input[type=checkbox]:not(.select-all)").property("checked", true);
	selectAllCheckbox.property("checked", true).property("indeterminate", false);
}

// Search Functionality
d3.select("#country-search").on("input", function () {
	const value = this.value.toLowerCase();
	const container = d3.select("#country-list");

	// 1. Select All
	container.selectAll(".checkbox-item").each(function () {
		const label = d3.select(this);
		//  Skip "Select All" checkbox
		if (label.select(".select-all").size() > 0) return;

		const text = label.text().toLowerCase();
		// 2.  Filter Logic
		if (text.includes(value)) {
			label.style("display", "flex");
		} else {
			label.style("display", "none");
		}
	});

	// 3. Reset Select All State
	container.select(".select-all").property("checked", false).property("indeterminate", false);
});

// --- HELPER: Get Selected Values (Exclude Select All) ---
function getSelectedValues(containerId) {
	const checked = [];
	d3.selectAll(`${containerId} input[type=checkbox]:checked:not(.select-all)`).each(function () {
		checked.push(this.value);
	});
	return checked;
}

function initSlider() {
	const sliderRange = d3.sliderBottom().min(2018).max(2024).width(200).tickFormat(d3.format('d')).ticks(5).step(1).default([2018, 2024]).fill('#2196f3')
		.on('onchange', val => { rangeYears = val; d3.select('#yearLabel').text(val.join('-')); updateDashboard(); });
	d3.select('div#slider-range').append('svg').attr('width', 240).attr('height', 50).append('g').attr('transform', 'translate(15,15)').call(sliderRange);
}

function resetAll() {
	// set all filter checkboxes to checked (select all)
	d3.selectAll("input[type=checkbox]:not(.select-all)").property("checked", true);
	d3.selectAll(".select-all").property("checked", true).property("indeterminate", false);
	// reset year range label to full range
	rangeYears = [2018, 2024];
	d3.select('#yearLabel').text(rangeYears.join('-'));
	updateDashboard();
}

// --- UPDATE DASHBOARD (Fix: No Data for Scatter Plot) ---
function updateDashboard() {
	const selCountries = getSelectedValues("#country-list");
	const selTypes = getSelectedValues("#type-list");

	// treat 'all countries selected' as Global View for UX consistency
	const totalCountryInputs = d3.selectAll("#country-list input[type=checkbox]:not(.select-all)").size();
	const showingGlobal = selCountries.length === 0 || selCountries.length === totalCountryInputs;
	d3.select("#active-country-count").text(showingGlobal ? "Global View" : `${selCountries.length} Selected`);
	d3.select("#filter-status").classed("hidden", showingGlobal);

	const filtered = rawData.filter(d => {
		const countryMatch = selCountries.length === 0 || selCountries.includes(d.country);
		const typeMatch = selTypes.length === 0 || selTypes.includes(d.type);
		const yearMatch = d.year >= rangeYears[0] && d.year <= rangeYears[1];
		return countryMatch && typeMatch && yearMatch;
	});

	d3.select("#kpi-events").text(filtered.length);
	d3.select("#kpi-loss").text(d3.format("$.2s")(d3.sum(filtered, d => d.loss)).replace("G", "B"));


	d3.selectAll(".chart-canvas, #chart-scatter").html("");

	if (filtered.length === 0) {
		d3.selectAll(".chart-canvas, #chart-scatter")
			.append("div")
			.attr("class", "no-data")
			.style("display", "flex")
			.style("justify-content", "center")
			.style("align-items", "center")
			.style("height", "100%")
			.style("color", "#cfd8dc")
			.style("font-weight", "bold")
			.text("No Data Found");
		return;
	}

	renderChoroplethMap(filtered, selCountries);
	renderHorizontalBar(filtered, selCountries);
	renderTreemap(filtered);
	renderScatter(filtered);
	renderTrendLine(filtered);
}

// --- STEP 1: MAP (Log Color Scale, Smaller Dots, Richer Tooltip) ---
function renderChoroplethMap(data, selectedCountries) {
	const container = document.getElementById("chart-map");
	d3.select("#chart-map").html("");

	const w = container.clientWidth;
	const h = 400;

	const svg = d3.select("#chart-map").append("svg")
		.attr("width", w).attr("height", h)
		.style("background", "#1e293b");

	const projection = d3.geoMercator().translate([w / 2, h / 1.5]);
	const path = d3.geoPath().projection(projection);

	const countries = topojson.feature(worldData, worldData.objects.countries).features;


	const counts = d3.rollup(data, v => v.length, d => d.mapName);
	const maxCount = d3.max(Array.from(counts.values())) || 1;

	const colorScale = d3.scaleSequentialLog(d3.interpolateYlOrRd)
		.domain([1, maxCount]);

	const g = svg.append("g");

	// --- MAP CONTROLS / ZOOM STATE ---
	// remove any old controls to avoid duplicates
	d3.select("#chart-map").selectAll(".map-controls").remove();
	const controls = d3.select("#chart-map").append("div").attr("class", "map-controls");
	controls.append("button").attr("class", "map-btn zoom-in").text("+").on("click", () => zoomBy(1.5));
	controls.append("button").attr("class", "map-btn zoom-out").text("-").on("click", () => zoomBy(1 / 1.5));
	controls.append("button").attr("class", "map-btn back-btn").text("⤺").on("click", () => resetZoomAndSelection());

	// compute total available country filters and show back only when some but not all are selected
	const totalCountryCount = d3.selectAll("#country-list input[type=checkbox]:not(.select-all)").size();
	controls.select(".back-btn").style("display", (selectedCountries && selectedCountries.length > 0 && selectedCountries.length < totalCountryCount) ? "block" : "none");

	// pan controls
	const panGrid = controls.append("div").attr("class", "pan-grid");
	panGrid.append("button").attr("class", "map-btn pan up").text("↑").on("click", () => panBy(0, -60));
	const middleRow = panGrid.append("div").attr("class", "pan-mid");
	middleRow.append("button").attr("class", "map-btn pan left").text("←").on("click", () => panBy(-80, 0));
	middleRow.append("button").attr("class", "map-btn pan right").text("→").on("click", () => panBy(80, 0));
	panGrid.append("button").attr("class", "map-btn pan down").text("↓").on("click", () => panBy(0, 60));

	let currentK = 1;
	let currentTx = 0;
	let currentTy = 0;
	let lastFocus = null; // pixel coords {x,y} to center zoom on selected country

	function setTransform(k, tx, ty) {
		currentK = k; currentTx = tx; currentTy = ty;
		g.transition().duration(400).attr("transform", `translate(${tx},${ty})scale(${k})`);
	}

	function zoomBy(factor) {
		const newK = currentK * factor;
		// choose focus point: selected country center if available, otherwise viewport center
		const focus = lastFocus || { x: w / 2, y: h / 2 };
		// maintain the focus screen point when scaling
		const newTx = currentTx - (newK - currentK) * focus.x;
		const newTy = currentTy - (newK - currentK) * focus.y;
		setTransform(newK, newTx, newTy);
	}

	function resetZoomAndSelection() {
		// return country filters to 'all selected' (global view)
		d3.selectAll("#country-list input[type=checkbox]:not(.select-all)").property("checked", true);
		d3.select("#country-list .select-all").property("checked", true).property("indeterminate", false);
		currentK = 1; currentTx = 0; currentTy = 0;
		// hide back button when fully reset
		controls.select(".back-btn").style("display", "none");
		g.transition().duration(600).attr("transform", "");
		updateDashboard();
	}

	function panBy(dx, dy) {
		// dx,dy are screen pixel offsets
		// invert directions to match intuitive arrow behavior (fixes reported inversion)
		const newTx = currentTx - dx;
		const newTy = currentTy - dy;
		setTransform(currentK, newTx, newTy);
	}

	// immediate set without transition (used for dragging)
	function immediateSet(k, tx, ty) {
		currentK = k; currentTx = tx; currentTy = ty;
		g.attr("transform", `translate(${tx},${ty})scale(${k})`);
	}

	// zoom centered at a given screen point
	function zoomAt(factor, focus) {
		const newK = Math.max(0.5, Math.min(16, currentK * factor));
		const newTx = currentTx - (newK - currentK) * focus.x;
		const newTy = currentTy - (newK - currentK) * focus.y;
		setTransform(newK, newTx, newTy);
		lastFocus = focus;
	}

	// enable dragging the map
	(function enableDrag() {
		let dragging = false;
		let start = null;
		let startTx = 0, startTy = 0;

		const dragBehavior = d3.drag()
			.on("start", (event) => {
				dragging = true;
				start = d3.pointer(event, svg.node());
				startTx = currentTx; startTy = currentTy;
			})
			.on("drag", (event) => {
				if (!dragging) return;
				const p = d3.pointer(event, svg.node());
				const dx = p[0] - start[0];
				const dy = p[1] - start[1];
				immediateSet(currentK, startTx + dx, startTy + dy);
			})
			.on("end", (event) => {
				dragging = false;
				// no transition on end; keep current transform state
			});

		svg.call(dragBehavior);
	})();

	// wheel zooming centered at mouse position
	(function enableWheel() {
		const node = svg.node();
		if (!node) return;
		node.addEventListener('wheel', function (ev) {
			ev.preventDefault();
			const rect = node.getBoundingClientRect();
			const mx = ev.clientX - rect.left;
			const my = ev.clientY - rect.top;
			const delta = -ev.deltaY;
			const factor = delta > 0 ? 1.12 : 1 / 1.12;
			// if a single country is selected, prefer zooming around that country's center
			const focus = (selectedCountries && selectedCountries.length === 1 && lastFocus) ? lastFocus : { x: mx, y: my };
			zoomAt(factor, focus);
		}, { passive: false });
	})();

	// 1. plot countries
	g.selectAll("path")
		.data(countries)
		.enter().append("path")
		.attr("d", path)
		.attr("fill", d => {
			const val = counts.get(d.properties.name);
			if (selectedCountries.length === 1 &&
				(nameMapping[selectedCountries[0]] === d.properties.name || selectedCountries[0] === d.properties.name)) {
				return "#263238"; // custom highlight color
			}
			// if no data, use default gray
			return (val && val > 0) ? colorScale(val) : "#37474f";
		})
		.attr("stroke", d => {
			const csvName = Object.keys(nameMapping).find(key => nameMapping[key] === d.properties.name) || d.properties.name;
			return (selectedCountries.includes(csvName)) ? "#00e5ff" : "#546e7a";
		})
		.attr("stroke-width", d => {
			const csvName = Object.keys(nameMapping).find(key => nameMapping[key] === d.properties.name) || d.properties.name;
			return (selectedCountries.includes(csvName)) ? 2 : 0.5;
		})
		.style("cursor", "pointer")
		.on("click", (e, d) => {
			e.stopPropagation();
			const csvName = Object.keys(nameMapping).find(key => nameMapping[key] === d.properties.name) || d.properties.name;
			d3.selectAll("#country-list input").property("checked", false);
			d3.select("#country-list .select-all").property("checked", false).property("indeterminate", false);
			d3.selectAll(`#country-list input[value='${csvName}']`).property("checked", true);
			updateDashboard();
		})
		.on("mouseover", function (e, d) {
			const val = counts.get(d.properties.name) || 0;
			d3.select(this).style("opacity", 0.7);
			showTooltip(e, `<b>${d.properties.name}</b><br>Total Events: ${val}`);
		})
		.on("mouseout", function () {
			d3.select(this).style("opacity", 1);
			hideTooltip();
		});

	// 2. scale and translate for single country zoom
	if (selectedCountries.length === 1) {
		const selectedFeatures = countries.filter(c => {
			const csvName = Object.keys(nameMapping).find(key => nameMapping[key] === c.properties.name) || c.properties.name;
			return selectedCountries.includes(csvName);
		});

		if (selectedFeatures.length > 0) {
			const bounds = path.bounds(selectedFeatures[0]);
			const dx = bounds[1][0] - bounds[0][0];
			const dy = bounds[1][1] - bounds[0][1];
			const x = (bounds[0][0] + bounds[1][0]) / 2;
			const y = (bounds[0][1] + bounds[1][1]) / 2;
			const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / w, dy / h)));
			const translate = [w / 2 - scale * x, h / 2 - scale * y];

			// remember focus (pixel coords) so zoom buttons center on this country
			lastFocus = { x: x, y: y };
			// apply computed transform and remember state
			setTransform(scale, translate[0], translate[1]);
			// show back button only when not all countries are selected
			controls.select(".back-btn").style("display", (selectedCountries && selectedCountries.length > 0 && selectedCountries.length < totalCountryCount) ? "block" : "none");
			// draw clusters for the zoomed feature
			setTimeout(() => drawCityClusters(scale, selectedFeatures[0]), 300);
		}
	} else {
		// reset transform for global view; show back button only when some but not all countries are selected
		currentK = 1; currentTx = 0; currentTy = 0;
		controls.select(".back-btn").style("display", (selectedCountries && selectedCountries.length > 0 && selectedCountries.length < totalCountryCount) ? "block" : "none");
		g.transition().duration(750).attr("transform", "");
	}

	// --- inner function: draw city clusters ---
	function drawCityClusters(scale, geoFeature) {
		const cityGroups = d3.rollup(data,
			v => {
				// find the most common type in this cluster
				const typeCounts = d3.rollup(v, c => c.length, d => d.type);
				//  sort and get the top one
				const mainType = Array.from(typeCounts).sort((a, b) => b[1] - a[1])[0][0];

				return {
					count: v.length,
					lat: v[0].lat,
					lng: v[0].lng,
					loss: d3.sum(v, d => d.loss),
					avgSeverity: d3.mean(v, d => d.severity),
					mainType: mainType
				};
			},
			d => `${d.lat.toFixed(1)},${d.lng.toFixed(1)}`
		);

		let cityData = Array.from(cityGroups.values());

		if (geoFeature) {
			cityData = cityData.filter(d => d3.geoContains(geoFeature, [d.lng, d.lat]));
		}

		const rScale = d3.scaleSqrt()
			.domain([0, d3.max(cityData, d => d.count) || 1])
			.range([1.5, 6]);


		const cityColorScale = d3.scaleSequentialLog(d3.interpolateYlOrRd)
			.domain([1, d3.max(cityData, d => d.count) || 1]);

		// If clusters are very dense, prefer compact dots and color to show frequency
		g.selectAll(".city-dot").remove();

		const baseRadius = Math.max(1.5, 3.5 / Math.sqrt(scale));
		const dots = g.selectAll(".city-dot")
			.data(cityData)
			.enter().append("circle")
			.attr("class", "city-dot")
			.attr("cx", d => projection([d.lng, d.lat])[0])
			.attr("cy", d => projection([d.lng, d.lat])[1])
			// use a mostly fixed small radius to avoid overlap; size variation is minimal
			.attr("r", d => baseRadius)
			.attr("fill", d => cityColorScale(d.count || 1))
			.attr("stroke", d => d3.rgb(cityColorScale(d.count || 1)).darker(1))
			.attr("stroke-width", 0.4 / scale)
			.attr("opacity", 0.95)
			.on("mouseover", function (e, d) {
				d3.select(this)
					.attr("stroke", "#ffffff")
					.attr("stroke-width", 2.5 / scale)
					.attr("r", rScale(d.count) / Math.sqrt(scale) * 1.8);


				let tooltipHtml = `<b>Location Cluster</b><br>`;
				tooltipHtml += `Events: <b>${d.count}</b><br>`;
				tooltipHtml += `Main Type: <b>${d.mainType}</b><br>`;
				const sevColor = d.avgSeverity > 7 ? "#d32f2f" : (d.avgSeverity > 4 ? "#f57c00" : "#388e3c");
				tooltipHtml += `Avg Severity: <b style="color:${sevColor}">${d.avgSeverity.toFixed(1)}</b><br>`;
				tooltipHtml += `Total Loss: $${d3.format(".2s")(d.loss)}`;

				showTooltip(e, tooltipHtml);
			})
			.on("mouseout", function (e, d) {
				d3.select(this)
					.attr("stroke", "#ffeb3b")
					.attr("stroke-width", 1 / scale)
					.attr("r", rScale(d.count) / Math.sqrt(scale));
				hideTooltip();
			});

		dots.raise();

		// update legend inside controls to reflect cluster counts
		(function updateClusterLegend() {
			const minC = d3.min(cityData, d => d.count) || 0;
			const maxC = d3.max(cityData, d => d.count) || 1;
			// ensure controls exist
			if (!controls) return;
			let legend = d3.select('#chart-map').select('.cluster-legend');
			if (legend.empty()) {
				legend = d3.select('#chart-map').append('div').attr('class', 'cluster-legend');
			}
			legend.html("");
			legend.append('div').attr('class', 'legend-title').text('Cluster Events');
			const bar = legend.append('div').attr('class', 'legend-bar');
			bar.style('background', `linear-gradient(90deg, ${d3.interpolateYlOrRd(0)} 0%, ${d3.interpolateYlOrRd(1)} 100%)`);
			const labels = legend.append('div').attr('class', 'legend-labels');
			labels.append('span').text(minC);
			labels.append('span').text(maxC);
		})();
	}
}
// --- STEP 2: BAR CHART (Linked Highlighting) ---
function renderHorizontalBar(data, selectedCountries) {
	const container = d3.select("#chart-bar");
	container.html("");
	const totalW = document.getElementById("chart-bar").clientWidth;
	const totalH = document.getElementById("chart-bar").clientHeight || 250;

	container.style("display", "flex").style("flex-direction", "row")
		.style("justify-content", "space-around").style("align-items", "center")
		.style("height", "100%").style("gap", "5px");

	const metrics = [
		{ id: "freq", title: "Frequency", color: "#00897b", format: d => d, getValue: v => v.length },
		{ id: "cas", title: "Casualties", color: "#e53935", format: d => d3.format(".2s")(d), getValue: v => d3.sum(v, d => d.casualties) },
		{ id: "loss", title: "Loss ($)", color: "#fb8c00", format: d => d3.format(".2s")(d), getValue: v => d3.sum(v, d => d.loss) }
	];

	const chartWidth = (totalW / 3) - 10;
	const chartHeight = totalH - 10;

	metrics.forEach(metric => {
		let chartData = [];
		if (selectedCountries.length !== 1) {
			const rolled = d3.rollup(data, metric.getValue, d => d.country);
			chartData = Array.from(rolled, ([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value).slice(0, 5);
		} else {
			const rolled = d3.rollup(data, metric.getValue, d => d.type);
			chartData = Array.from(rolled, ([key, value]) => ({ key: key, value })).sort((a, b) => b.value - a.value).slice(0, 5);
		}

		const wrapper = container.append("div").style("width", `${chartWidth}px`).style("height", `${chartHeight}px`).style("position", "relative");
		const svg = wrapper.append("svg").attr("width", chartWidth).attr("height", chartHeight);
		const m = { top: 25, right: 10, bottom: 30, left: 45 };
		const w = chartWidth - m.left - m.right; const h = chartHeight - m.top - m.bottom;
		const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);

		const x = d3.scaleBand().domain(chartData.map(d => d.key)).range([0, w]).padding(0.3);
		const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) || 1]).range([h, 0]);

		svg.append("text").attr("x", chartWidth / 2).attr("y", 15).text(metric.title).attr("fill", metric.color)
			.attr("text-anchor", "middle").style("font-size", "13px").style("font-weight", "bold");

		g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickSize(0).tickFormat(d => d.length > 3 && isNaN(d) ? d.substring(0, 3).toUpperCase() : d))
			.selectAll("text").style("fill", "#37474f").style("font-size", "10px").style("font-weight", "bold").style("text-anchor", "middle");
		g.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".1s"))).selectAll("text").style("fill", "#37474f").style("font-size", "10px");
		g.select(".domain").remove();

		g.selectAll("rect").data(chartData).enter().append("rect")
			.attr("x", d => x(d.key)).attr("y", d => y(d.value))
			.attr("width", x.bandwidth()).attr("height", d => h - y(d.value))
			.attr("fill", metric.color).attr("rx", 2)
			.attr("class", d => `metric-bar bar-${toSafeID(d.key)}`)
			.on("mouseover", function (e, d) {
				showTooltip(e, `<b>${d.key}</b><br>${metric.title}: ${metric.format(d.value)}`);

				d3.selectAll(".metric-bar").style("opacity", 0.2);
				d3.selectAll(`.bar-${toSafeID(d.key)}`).style("opacity", 1).style("stroke", "#333").style("stroke-width", 1.5);
			})
			.on("mouseout", function () {
				hideTooltip();
				d3.selectAll(".metric-bar").style("opacity", 1).style("stroke", "none");
			});
	});
	d3.select("#analyze-title").text(selectedCountries.length === 1 ? `Impact Prioritization by Type - ${selectedCountries[0]}` : "Impact Analysis (Top 5 Countries)");
}
// --- STEP 3-1: TREEMAP (Aid distributed across disaster types) ---
function renderTreemap(data) {
	function wrapText(textSelection, maxWidth) {
		textSelection.each(function () {
			const text = d3.select(this);
			const words = text.text().split(/\s+/).reverse();
			let word;
			let line = [];
			let lineNumber = 0;

			const lineHeight = 1.2; // em
			const y = text.attr("y");
			const x = text.attr("x");

			let tspan = text.text(null)
				.append("tspan")
				.attr("x", x)
				.attr("y", y);

			while (word = words.pop()) {
				line.push(word);
				tspan.text(line.join(" "));

				if (tspan.node().getComputedTextLength() > maxWidth) {
					line.pop();
					tspan.text(line.join(" "));
					line = [word];
					tspan = text.append("tspan")
						.attr("x", x)
						.attr("dy", `${lineHeight}em`)
						.text(word);
				}
			}
		});
	}

	const container = document.getElementById("chart-treemap");
	d3.select("#chart-treemap").html("");

	const w = container.clientWidth;
	const h = container.clientHeight || 260;

	const svg = d3.select("#chart-treemap")
		.append("svg")
		.attr("width", w)
		.attr("height", h);

	// --- aggregate aid by disaster type ---
	const aidByType = d3.rollups(
		data,
		v => d3.sum(v, d => d.aid),
		d => d.type
	);

	const treemapData = {
		name: "Aid",
		children: aidByType.map(([type, value]) => ({
			name: type,
			value: value
		}))
	};

	const root = d3.hierarchy(treemapData)
		.sum(d => d.value)
		.sort((a, b) => b.value - a.value);

	d3.treemap()
		.size([w, h])
		.padding(2)(root);

	const maxAid = d3.max(root.leaves(), d => d.value) || 1;

	const color = d3.scaleSequential(d3.interpolateYlOrRd)
		.domain([0, maxAid])
		.clamp(true);

	const nodes = svg.selectAll("g")
		.data(root.leaves())
		.enter()
		.append("g")
		.attr("transform", d => `translate(${d.x0},${d.y0})`);

	nodes.append("rect")
		.attr("width", d => d.x1 - d.x0)
		.attr("height", d => d.y1 - d.y0)
		.attr("rx", 3)
		.attr("fill", d => color(d.value))
		.on("mouseover", (e, d) => {
			d3.select(e.currentTarget)
				.attr("stroke", "#000")
				.attr("stroke-width", 1.5);

			const total = d3.sum(root.leaves(), n => n.value);
			const percent = ((d.value / total) * 100).toFixed(1);

			showTooltip(
				e,
				`<b>${d.data.name}</b><br>
				 Aid: <b>${d3.format("$.2s")(d.value)}</b><br>
				 Share: <b>${percent}%</b>`
			);

			// linked highlight (Step 2 bar chart)
			const typeClass = toSafeID(d.data.name);

			// fade all bars
			d3.selectAll(".metric-bar")
				.style("opacity", 0.2)
				.style("stroke", "none");

			// highlight matched bars
			d3.selectAll(`.bar-${typeClass}`)
				.style("opacity", 1)
				.style("stroke", "#000")
				.style("stroke-width", 1.5);
		})
		.on("mouseout", function () {
			d3.select(this).attr("stroke", null);
			hideTooltip();

			// --- restore bar chart ---
			d3.selectAll(".metric-bar")
				.style("opacity", 1)
				.style("stroke", "none");
		});

	const LABEL_FONT_SIZE = 14;
	const LABEL_PADDING = 6;

	const labels = nodes.append("text")
		.attr("x", LABEL_PADDING)
		.attr("y", LABEL_FONT_SIZE + LABEL_PADDING)
		.text(d => d.data.name)
		.style("font-size", "14px")
		.style("font-weight", "600")
		.style("fill", "#ffffff")
		.style("pointer-events", "none")
		.style("display", d => {
			const w = d.x1 - d.x0;
			const h = d.y1 - d.y0;
			return (w > 60 && h > 30) ? "block" : "none";
		});
	labels.each(function (d) {
		const w = d.x1 - d.x0;
		wrapText(d3.select(this), w - LABEL_PADDING * 2);
	});

}
// --- STEP 3-2: SCATTER PLOT (Aid vs Severity) ---
function renderScatter(data) {
	const container = document.getElementById("chart-scatter");
	d3.select("#chart-scatter").html("");
	const w = container.clientWidth; const h = container.clientHeight || 250;
	const m = { top: 20, right: 20, bottom: 40, left: 60 };
	const width = w - m.left - m.right; const height = h - m.top - m.bottom;

	const topEvents = [...data].sort((a, b) => b.loss - a.loss).slice(0, 2000);

	const wrapper = d3.select("#chart-scatter").style("position", "relative").style("width", w + "px").style("height", h + "px");
	const canvas = wrapper.append("canvas").attr("width", width).attr("height", height)
		.style("position", "absolute").style("top", m.top + "px").style("left", m.left + "px");
	const context = canvas.node().getContext("2d");
	const svg = wrapper.append("svg").attr("width", w).attr("height", h).style("position", "absolute")
		.style("top", "0px").style("left", "0px").style("pointer-events", "none")
		.append("g").attr("transform", `translate(${m.left},${m.top})`);

	const x = d3.scaleLinear().domain([0, 10]).range([0, width]);
	const y = d3.scaleLinear().domain([0, d3.max(topEvents, d => d.aid) || 100000]).range([height, 0]).nice();
	const rScale = d3.scaleSqrt().domain([0, d3.max(topEvents, d => d.loss) || 1e9]).range([3, 18]);
	const colorScale = d3.scaleOrdinal().domain(["Earthquake", "Flood", "Storm", "Wildfire", "Drought", "Volcano"]).range(["#7986cb", "#4fc3f7", "#9ccc65", "#ff8a65", "#ba68c8", "#90a4ae"]);

	svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
	svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("$.2s")));

	svg.append("text").attr("x", width / 2).attr("y", height + 30).text("Severity Index").style("font-size", "11px").attr("fill", "#546e7a").attr("text-anchor", "middle");
	svg.append("text").attr("transform", "rotate(-90)").attr("y", -45).attr("x", -height / 2).text("Aid Amount (USD)").style("font-size", "11px").attr("fill", "#546e7a").attr("text-anchor", "middle");

	svg.append("text").attr("x", 10).attr("y", 0).text(`Showing Top ${topEvents.length} Major Events`).style("font-size", "10px").style("fill", "#0288d1").style("font-weight", "bold");

	function drawCanvas(hoveredDataPoint) {
		context.clearRect(0, 0, width, height);
		topEvents.sort((a, b) => b.loss - a.loss);
		topEvents.forEach(d => {
			const px = x(d.severity); const py = y(d.aid); const r = rScale(d.loss);
			const isHovered = hoveredDataPoint && d === hoveredDataPoint;
			context.beginPath(); context.arc(px, py, r, 0, 2 * Math.PI);
			context.fillStyle = colorScale(d.type); context.globalAlpha = isHovered ? 1.0 : 0.6; context.fill();
			context.lineWidth = isHovered ? 3 : 0.5; context.strokeStyle = isHovered ? "#ffffff" : "rgba(255,255,255,0.3)"; context.stroke();
			context.globalAlpha = 1.0;
		});
	}
	drawCanvas(null);

	d3.select(canvas.node()).on("mousemove", function (event) {
		const [mouseX, mouseY] = d3.pointer(event);
		let minDist = Infinity; let closest = null;
		topEvents.forEach(d => {
			const px = x(d.severity); const py = y(d.aid);
			const dist = Math.sqrt((px - mouseX) ** 2 + (py - mouseY) ** 2);
			if (dist < rScale(d.loss) + 4 && dist < minDist) { minDist = dist; closest = d; }
		});

		drawCanvas(closest);

		if (closest) {
			d3.select("#scatter-placeholder").style("display", "none");
			d3.select("#scatter-details").classed("hidden", false);
			d3.select("#d-country").text(closest.country);
			d3.select("#d-year").text(closest.year);
			d3.select("#d-type").html(`<span style="color:${colorScale(closest.type)}">●</span> ${closest.type}`);

			d3.select("#d-sev-aid").html(`Severity: <b>${closest.severity}</b> <br> Aid: <b style="color:#2e7d32">${d3.format("$.2s")(closest.aid)}</b>`);

			d3.select("#d-loss").text(d3.format("$.2s")(closest.loss));

			d3.selectAll(".metric-bar").style("opacity", 0.2);
			d3.selectAll(`.bar-${toSafeID(closest.type)}`).style("opacity", 1).style("stroke", "#333").style("stroke-width", 1.5);
			d3.selectAll(`.bar-${toSafeID(closest.country)}`).style("opacity", 1).style("stroke", "#333").style("stroke-width", 1.5);

		} else {
			d3.select("#scatter-details").classed("hidden", true);
			d3.select("#scatter-placeholder").style("display", "block");
			d3.selectAll(".metric-bar").style("opacity", 1).style("stroke", "none");
		}
	}).on("mouseleave", function () {
		drawCanvas(null);
		d3.select("#scatter-details").classed("hidden", true);
		d3.select("#scatter-placeholder").style("display", "block");
		d3.selectAll(".metric-bar").style("opacity", 1).style("stroke", "none");
	});
}

// --- STEP 4: LINE CHART ---
function renderTrendLine(data) {
	const container = document.getElementById("chart-line");
	const w = container.clientWidth; const h = 250; const m = { top: 20, right: 30, bottom: 40, left: 60 };
	d3.select("#chart-line").html("");
	const svg = d3.select("#chart-line").append("svg").attr("width", w).attr("height", h).append("g").attr("transform", `translate(${m.left},${m.top})`);
	const width = w - m.left - m.right; const height = h - m.top - m.bottom;

	const rolled = d3.rollup(data, v => d3.mean(v, d => d.time), d => d.year);
	const lineData = Array.from(rolled, ([year, val]) => ({ year, val })).sort((a, b) => a.year - b.year);

	if (lineData.length < 2) { svg.append("text").attr("x", width / 2).attr("y", height / 2).text("Not enough data").attr("text-anchor", "middle"); return; }

	const x = d3.scaleLinear().domain(d3.extent(lineData, d => d.year)).range([0, width]);
	const y = d3.scaleLinear().domain([0, d3.max(lineData, d => d.val) * 1.2]).range([height, 0]);

	svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
	svg.append("g").call(d3.axisLeft(y));
	svg.append("text").attr("x", width / 2).attr("y", height + 35).text("Year").attr("text-anchor", "middle").style("font-size", "11px");
	svg.append("text").attr("transform", "rotate(-90)").attr("y", -35).attr("x", -height / 2).text("Avg Time (Hrs)").attr("text-anchor", "middle").style("font-size", "11px");

	const line = d3.line().x(d => x(d.year)).y(d => y(d.val));
	svg.append("path").datum(lineData).attr("fill", "none").attr("stroke", "#66bb6a").attr("stroke-width", 3).attr("d", line);
	svg.selectAll("circle").data(lineData).enter().append("circle").attr("cx", d => x(d.year)).attr("cy", d => y(d.val)).attr("r", 5).attr("fill", "#2e7d32")
		.on("mouseover", (e, d) => showTooltip(e, `Avg: ${d.val.toFixed(1)}h`)).on("mouseout", hideTooltip);
}

const tooltip = d3.select("#tooltip");
function showTooltip(e, html) {
	tooltip
		.classed("hidden", false)
		.html(html);

	const tooltipNode = tooltip.node();
	const tooltipWidth = tooltipNode.offsetWidth;
	const tooltipHeight = tooltipNode.offsetHeight;

	const padding = 12;

	const pageWidth = window.innerWidth;
	const pageHeight = window.innerHeight;

	let x = e.pageX + padding;
	let y = e.pageY + padding;

	if (x + tooltipWidth > pageWidth) {
		x = e.pageX - tooltipWidth - padding;
	}

	if (y + tooltipHeight > pageHeight) {
		y = e.pageY - tooltipHeight - padding;
	}

	tooltip
		.style("left", x + "px")
		.style("top", y + "px");
}
function hideTooltip() { tooltip.classed("hidden", true); }

