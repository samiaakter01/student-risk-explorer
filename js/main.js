const terrainSvg = d3.select("#terrain");
const sankeySvg = d3.select("#sankey");
const terrainTip = d3.select("#terrainTip");
const flowTip = d3.select("#flowTip");
const targetFilter = d3.select("#targetFilter");
const courseFilter = d3.select("#courseFilter");
const terrainMetric = d3.select("#terrainMetric");
const resetBtn = d3.select("#resetBtn");
const zoomBtn = d3.select("#zoomBtn");
const terrainHint = d3.select("#terrainHint");
const selectionText = d3.select("#selectionText");
const terrainReadout = d3.select("#terrainReadout");

const COLORS = {
  Dropout: "#e58a52",
  Enrolled: "#4f83a7",
  Graduate: "#1e4d43"
};

const courseNames = {
  33:"Biofuel Production Technologies", 171:"Animation & Multimedia Design",
  8014:"Social Service (evening)", 9003:"Agronomy", 9070:"Communication Design",
  9085:"Veterinary Nursing", 9119:"Informatics Engineering", 9130:"Equinculture",
  9147:"Management", 9238:"Social Service", 9254:"Tourism", 9500:"Nursing",
  9556:"Oral Hygiene", 9670:"Advertising & Marketing", 9773:"Journalism & Communication",
  9853:"Basic Education", 9991:"Management (evening)"
};

const HIGHER_ED_CODES = new Set([2,3,4,5,40,41,42,43,44]);

let students = [];
let active = [];
let selectedBinKey = null;
let zoomBehavior;
let zoomEnabled = false;
let terrainG;
let binLayer;
let lastFlowSelection = null;

const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const pct = (a,b) => b ? a / b : 0;

function prepare(rows){
  return rows.map((r,i) => {
    const s = {...r, id:i};
    const enroll1 = +r["Curricular units 1st sem (enrolled)"];
    const appr1 = +r["Curricular units 1st sem (approved)"];
    const enroll2 = +r["Curricular units 2nd sem (enrolled)"];
    const appr2 = +r["Curricular units 2nd sem (approved)"];
    const grade1 = +r["Curricular units 1st sem (grade)"];
    const grade2 = +r["Curricular units 2nd sem (grade)"];

    const approval = (pct(appr1,enroll1) + pct(appr2,enroll2)) / 2;
    const grade = ((grade1/20) + (grade2/20)) / 2;
    const academic = clamp((approval*.65 + grade*.35)*100,0,100);

    const financial = (+r["Debtor"]===1 ? 1 : 0) + (+r["Tuition fees up to date"]===0 ? 1 : 0);
    const parentsHigher =
      (HIGHER_ED_CODES.has(+r["Mother's qualification"]) ? 1 : 0) +
      (HIGHER_ED_CODES.has(+r["Father's qualification"]) ? 1 : 0);

    const context = clamp(
      (financial/2)*55 +
      (parentsHigher===0 ? 22 : parentsHigher===1 ? 9 : 0) +
      (+r["Displaced"]===1 ? 12 : 0) +
      (+r["Age at enrollment"]>=25 ? 11 : 0), 0, 100
    );

    const engagement =
      (+r["Curricular units 1st sem (evaluations)"]===0 ? 1 : 0) +
      (+r["Curricular units 2nd sem (evaluations)"]===0 ? 1 : 0) +
      (+r["Curricular units 1st sem (without evaluations)"]>0 ? 1 : 0) +
      (+r["Curricular units 2nd sem (without evaluations)"]>0 ? 1 : 0);

    s.academic = academic;
    s.context = context;
    s.approval = approval;
    s.grade = grade;
    s.financial = financial;
    s.parentsHigher = parentsHigher;
    s.engagement = engagement;
    s.courseName = courseNames[r.Course] || `Course ${r.Course}`;

    s.academicBand = academic <= 40 ? "Fragile academic" :
                     academic <= 70 ? "Developing academic" : "Stable academic";
    s.contextBand = context <= 25 ? "Lower socioeconomic pressure" :
                    context <= 50 ? "Moderate socioeconomic pressure" : "High socioeconomic pressure";
    const academicShort = academic <= 40 ? "Fragile" : academic <= 70 ? "Developing" : "Stable";
    const contextShort = context <= 25 ? "Lower" : context <= 50 ? "Moderate" : "High";
    s.shortAcademicBand = academicShort;
    s.shortContextBand = contextShort;
    s.shortProfile = `${academicShort} · ${contextShort}`;
    s.profile = `${s.academicBand} · ${s.contextBand}`;

    return s;
  });
}

function renderLegend(){
  d3.select("#targetLegend").html(
    Object.entries(COLORS).map(([name,color]) =>
      `<span class="legend-item"><i class="legend-dot" style="background:${color}"></i>${name}</span>`
    ).join("")
  );
}

function activeData(){
  let a = students;
  const t = targetFilter.property("value");
  const c = courseFilter.property("value");
  if(t !== "All") a = a.filter(d => d.Target === t);
  if(c !== "All") a = a.filter(d => String(d.Course) === c);
  return a;
}

function updateSelection(n){
  selectionText.text(`${n.toLocaleString()} of ${students.length.toLocaleString()} students`);
}

function updateFlowContext(){
  const courseValue = courseFilter.property("value");
  const courseLabel = courseValue === "All"
    ? "All courses"
    : courseFilter.selectAll("option").filter(function(){ return this.value === courseValue; }).text();
  d3.select("#flowCourse").html(
    `<span class="flow-course-label">Course</span> ${courseLabel || "All courses"}`
  );
}

function riskColor(value){
  if(terrainMetric.property("value")==="count"){
    const maxCount=d3.max(makeBins(active),d=>d.count)||1;
    return d3.interpolateRgb("#e6eee8","#1e4d43")(clamp(value/maxCount,0,1));
  }
  return d3.interpolateRgb("#dbe8df","#e58a52")(clamp(value,0,1));
}

function makeBins(data){
  const xStep = 10, yStep = 10;
  const bins = new Map();

  data.forEach(d => {
    const x0 = Math.min(90, Math.floor(d.academic/xStep)*xStep);
    const y0 = Math.min(90, Math.floor(d.context/yStep)*yStep);
    const key = `${x0}-${y0}`;
    if(!bins.has(key)) bins.set(key, {
      key, x0, y0, x1:x0+xStep, y1:y0+yStep, students:[], outcomes:{Dropout:0,Enrolled:0,Graduate:0}
    });
    const b = bins.get(key);
    b.students.push(d);
    b.outcomes[d.Target] = (b.outcomes[d.Target] || 0) + 1;
  });

  return [...bins.values()].map(b => {
    b.count = b.students.length;
    b.dropoutRate = b.outcomes.Dropout / b.count;
    b.avgAge = d3.mean(b.students,d=>+d["Age at enrollment"]);
    return b;
  });
}

function terrainScales(W,H){
  const margin = {top:48,right:26,bottom:58,left:62};
  return {
    margin,
    x:d3.scaleLinear().domain([0,100]).range([margin.left,W-margin.right]),
    y:d3.scaleLinear().domain([0,100]).range([H-margin.bottom,margin.top]),
    r:d3.scaleSqrt().domain([1,d3.max(makeBins(active),d=>d.count)||1]).range([5,30])
  };
}

function drawTerrain({animate=true}={}){
  const wrap = document.querySelector("#terrainWrap");
  const W = wrap.clientWidth - 16;
  const H = wrap.clientHeight - 8;
  terrainSvg.selectAll("*").remove();

  const {margin,x,y,r} = terrainScales(W,H);
  terrainG = terrainSvg.append("g");
  const plot = terrainG.append("g").attr("class","plot");
  const bins = makeBins(active);

  plot.append("rect")
    .attr("x",x(0)).attr("y",y(100))
    .attr("width",x(40)-x(0)).attr("height",y(0)-y(100))
    .attr("fill","#f3dfd2").attr("opacity",.30);

  plot.append("rect")
    .attr("x",x(40)).attr("y",y(100))
    .attr("width",x(100)-x(40)).attr("height",y(0)-y(100))
    .attr("fill","#e5eee7").attr("opacity",.20);

  plot.append("g").selectAll("line")
    .data([20,40,60,80]).join("line")
    .attr("class","gridline")
    .attr("x1",d=>x(d)).attr("x2",d=>x(d))
    .attr("y1",y(0)).attr("y2",y(100));

  plot.append("g").selectAll("line")
    .data([20,40,60,80]).join("line")
    .attr("class","gridline")
    .attr("x1",x(0)).attr("x2",x(100))
    .attr("y1",d=>y(d)).attr("y2",d=>y(d));

  plot.append("line").attr("class","zero-line")
    .attr("x1",x(40)).attr("x2",x(40)).attr("y1",y(0)).attr("y2",y(100));
  plot.append("line").attr("class","zero-line")
    .attr("x1",x(0)).attr("x2",x(100)).attr("y1",y(25)).attr("y2",y(25));

  plot.append("text").attr("class","zone-label")
    .attr("x",x(3)).attr("y",y(94)).text("HIGHER PRIORITY");
  plot.append("text").attr("class","zone-label")
    .attr("x",x(68)).attr("y",y(94)).text("STRONGER ACADEMICS");

  const xAxis = plot.append("g").attr("class","axis")
    .attr("transform",`translate(0,${y(0)})`).call(d3.axisBottom(x).ticks(5));
  const yAxis = plot.append("g").attr("class","axis")
    .attr("transform",`translate(${x(0)},0)`).call(d3.axisLeft(y).ticks(5));

  xAxis.append("text").attr("x",(x(100)-x(0))/2).attr("y",43)
    .attr("fill","#66736f").attr("font-size",11).text("Academic stability → stronger");
  yAxis.append("text").attr("transform","rotate(-90)")
    .attr("x",-(y(0)-y(100))/2).attr("y",-45).attr("text-anchor","middle")
    .attr("fill","#66736f").attr("font-size",11).text("Socioeconomic pressure → higher");


  binLayer = plot.append("g").attr("class","bin-layer");

  const bubbles = binLayer.selectAll(".bubble")
    .data(bins,d=>d.key)
    .join("circle")
    .attr("class","bubble")
    .attr("cx",d=>x(d.x0+5))
    .attr("cy",d=>y(d.y0+5))
    .attr("r",animate?0:d=>r(d.count))
    .attr("fill",d=>riskColor(terrainMetric.property("value")==="count" ? d.count : d.dropoutRate))
    .attr("opacity",.94)
    .on("mouseenter",(event,d)=>showTerrainTip(event,d,wrap))
    .on("mousemove",(event)=>moveTip(event,wrap,terrainTip))
    .on("mouseleave",()=>terrainTip.style("opacity",0))
    .on("click",(event,d)=>{
      event.stopPropagation();
      selectedBinKey = d.key;
      const ids = new Set(d.students.map(s=>s.id));
      updateSelection(d.count);
      updateTerrainSelection(ids);
      renderFlow(d.students);
      showReadout(d);
    });

  if(animate){
    bubbles.transition().duration(750).delay((d,i)=>Math.min(i*8,700))
      .ease(d3.easeBackOut.overshoot(1.2)).attr("r",d=>r(d.count));
  }

  bubbles.classed("selected",d=>d.key===selectedBinKey);

  // Outcome mini-rings make the bin carry both density and composition without adding another chart.
  binLayer.selectAll(".ring")
    .data(bins,d=>d.key)
    .join("path")
    .attr("class","ring")
    .attr("d",d=>{
      const cx=x(d.x0+5), cy=y(d.y0+5), rr=Math.max(5,r(d.count)+3);
      let a=-Math.PI/2, path="";
      const total=d.count;
      ["Dropout","Enrolled","Graduate"].forEach(k=>{
        const a1=a+(d.outcomes[k]/total)*Math.PI*2;
        const arc=d3.arc().innerRadius(rr).outerRadius(rr+2).startAngle(a).endAngle(a1);
        path += arc({}) || "";
        a=a1;
      });
      // individual arcs need separate paths; this placeholder is replaced below
      return "";
    });

  // Replace placeholder rings with one arc per outcome segment.
  const arcs = binLayer.selectAll(".outcome-arc").data(
    bins.flatMap(b=>{
      let a=-Math.PI/2;
      return ["Dropout","Enrolled","Graduate"].map(k=>{
        const a0=a;
        a += (b.outcomes[k]/b.count)*Math.PI*2;
        return {...b, outcome:k, a0, a1:a};
      }).filter(d=>d.a1-d.a0>0.01);
    }),
    d=>`${d.key}-${d.outcome}`
  ).join("path")
    .attr("class","outcome-arc")
    .attr("transform",d=>`translate(${x(d.x0+5)},${y(d.y0+5)})`)
    .attr("fill",d=>COLORS[d.outcome])
    .attr("opacity",.75)
    .attr("d",d=>d3.arc().innerRadius(Math.max(5,r(d.count)+3)).outerRadius(Math.max(5,r(d.count)+3)+2).startAngle(d.a0).endAngle(d.a1)());

  binLayer.selectAll(".bubble-label").data(bins,d=>d.key).join("text")
    .attr("class",d=>`bubble-label ${d.dropoutRate<.35?"dark":""}`)
    .attr("x",d=>x(d.x0+5)).attr("y",d=>y(d.y0+5))
    .text(d=>d.count>=35 ? d.count : "");

  zoomBehavior = d3.zoom()
    .scaleExtent([1,7])
    .filter(event => zoomEnabled && !event.button)
    .on("zoom",({transform})=>terrainG.attr("transform",transform));
  terrainSvg.call(zoomBehavior).on("dblclick.zoom",null);

  updateZoomControls();

  terrainSvg.on("click",()=>{
    selectedBinKey=null;
    terrainReadout.classed("show",false);
    clearSelection();
    renderFlow(active);
  });
}


function updateZoomControls(){
  if(!zoomBtn || zoomBtn.empty()) return;
  zoomBtn
    .text(`Zoom: ${zoomEnabled ? "On" : "Off"}`)
    .attr("aria-pressed", zoomEnabled ? "true" : "false")
    .classed("primary", zoomEnabled)
    .classed("secondary", !zoomEnabled);

  terrainHint.text(zoomEnabled
    ? "Zoom is on · Scroll/pinch to zoom · Drag to pan · Click a bubble to explore"
    : "Turn Zoom on first · Scroll/pinch to zoom · Drag to pan · Click a bubble to explore"
  );
}

function setZoomEnabled(enabled){
  zoomEnabled = enabled;
  updateZoomControls();

  if(!zoomBehavior) return;
  if(!zoomEnabled){
    terrainSvg.transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
  }
}

function showTerrainTip(event,d,wrap){
  terrainTip.style("opacity",1).html(`
    <b>${d.count.toLocaleString()} students</b><br>
    Academic stability: ${d.x0}–${d.x1}<br>
    Socioeconomic pressure: ${d.y0}–${d.y1}<br>
    <b>Observed dropout: ${(d.dropoutRate*100).toFixed(1)}%</b><br>
    Graduate: ${(d.outcomes.Graduate/d.count*100).toFixed(1)}% · Enrolled: ${(d.outcomes.Enrolled/d.count*100).toFixed(1)}%
  `);
  moveTip(event,wrap,terrainTip);
}

function moveTip(event,wrap,tip){
  const rect=wrap.getBoundingClientRect();
  tip.style("left",`${event.clientX-rect.left+12}px`)
     .style("top",`${event.clientY-rect.top+12}px`);
}

function showReadout(d){
  terrainReadout.html(
    `<b>${d.profile || "Selected risk zone"}</b><br>${d.count.toLocaleString()} students · ${(d.dropoutRate*100).toFixed(1)}% observed dropout`
  ).classed("show",true);
}

function updateTerrainSelection(ids){
  binLayer.selectAll(".bubble")
    .classed("selected",d=>d.students.some(s=>ids.has(s.id)))
    .classed("dim",d=>!d.students.some(s=>ids.has(s.id)));
}

function clearSelection(){
  if(binLayer) binLayer.selectAll(".bubble").classed("selected",false).classed("dim",false);
  selectionText.text(`${active.length.toLocaleString()} of ${students.length.toLocaleString()} students`);
}

function profileData(data){
  const groups = d3.rollups(
    data,
    v=>({count:v.length, students:v}),
    d=>d.academicBand,
    d=>d.contextBand,
    d=>d.Target
  );

  const profiles = [];
  const profileMap = new Map();

  groups.forEach(([a,contexts])=>{
    contexts.forEach(([c,targets])=>{
      const academicShort = a.startsWith("Fragile") ? "Fragile" : a.startsWith("Developing") ? "Developing" : "Stable";
      const contextShort = c.startsWith("Lower") ? "Lower" : c.startsWith("Moderate") ? "Moderate" : "High";
      const profile = `${a} · ${c}`;
      const shortProfile = `${academicShort} · ${contextShort}`;
      const p = {profile, shortProfile, a, c, count:0, students:[], outcomes:{Dropout:0,Enrolled:0,Graduate:0}};
      targets.forEach(([t,obj])=>{
        p.count += obj.count;
        p.students.push(...obj.students);
        p.outcomes[t]=obj.count;
      });
      if(p.count) profiles.push(p);
    });
  });
  return profiles;
}

// Sankey tooltips are calculated from the currently filtered D3 data, so they update with Outcome/Course filters.
function renderFlow(data){
  updateFlowContext();
  const wrap=document.querySelector("#flowWrap");
  const W=wrap.clientWidth-16, H=wrap.clientHeight-8;
  sankeySvg.selectAll("*").remove();

  const profiles=profileData(data);
  const margin={top:38,right:120,bottom:24,left:185};
  const width=W-margin.left-margin.right;
  const height=H-margin.top-margin.bottom;

  const nodes=[];
  profiles.forEach((p,i)=>nodes.push({
    id:`P${i}`,
    name:p.shortProfile,
    stage:"profile",
    profile:p
  }));
  ["Dropout","Enrolled","Graduate"].forEach((name,i)=>nodes.push({id:`T${i}`,name,stage:"outcome"}));

  const links=[];
  profiles.forEach((p,i)=>{
    ["Dropout","Enrolled","Graduate"].forEach((t,j)=>{
      if(p.outcomes[t]) links.push({
        source:`P${i}`,
        target:`T${j}`,
        value:p.outcomes[t],
        profile:p,
        outcome:t,
        students:p.students.filter(s=>s.Target===t)
      });
    });
  });

  const sk=d3.sankey()
    .nodeId(d=>d.id)
    .nodeWidth(15)
    .nodePadding(13)
    .extent([[0,0],[width,height]]);

  const graph=sk({
    nodes:nodes.map(d=>({...d})),
    links:links.map(d=>({...d}))
  });

  sankeySvg.append("g").attr("transform",`translate(${margin.left},${margin.top})`).call(g=>{
    g.append("text").attr("class","flow-title").attr("x",0).attr("y",-17).text("ACADEMIC STABILITY · SOCIOECONOMIC PRESSURE");
    g.append("text").attr("class","flow-title").attr("x",width).attr("y",-17).attr("text-anchor","end").text("OBSERVED OUTCOME");

    const linkLayer=g.append("g").attr("class","links");
    const link=linkLayer.selectAll("path").data(graph.links).join("path")
      .attr("class","sankey-link")
      .attr("d",d3.sankeyLinkHorizontal())
      .attr("stroke",d=>COLORS[d.outcome])
      .attr("stroke-width",d=>Math.max(1,d.width))
      .on("mouseenter",(event,d)=>{
        const profileTotal = d.profile.count || 0;
        const share = profileTotal ? (d.value / profileTotal * 100).toFixed(1) : "0.0";
        flowTip.style("opacity",1).html(`
          <div class="tooltip-title">${d.profile.profile} → ${d.outcome}</div>
          <div class="tooltip-count">${d.value.toLocaleString()} students</div>
          <div>${share}% of this profile</div>
        `);
        moveTip(event,wrap,flowTip);
      })
      .on("mousemove",(event)=>moveTip(event,wrap,flowTip))
      .on("mouseleave",()=>flowTip.style("opacity",0))
      .on("click",(event,d)=>{
        event.stopPropagation();
        lastFlowSelection=d;
        const ids=new Set(d.students.map(s=>s.id));
        updateTerrainSelection(ids);
        updateSelection(d.students.length);
        terrainReadout.html(`<b>${d.profile.profile}</b><br>${d.students.length.toLocaleString()} ${d.outcome.toLowerCase()} students selected`).classed("show",true);
        link.classed("selected",x=>x===d);
      });

    const node=g.append("g").selectAll("rect").data(graph.nodes).join("rect")
      .attr("class","sankey-node")
      .attr("x",d=>d.x0).attr("y",d=>d.y0)
      .attr("width",d=>d.x1-d.x0)
      .attr("height",d=>Math.max(2,d.y1-d.y0))
      .attr("rx",5)
      .attr("fill",d=>d.stage==="outcome"?COLORS[d.name]:"#2f6b5d")
      .on("mouseenter",(event,d)=>{
        if(d.stage === "profile"){
          const p = d.profile;
          const total = p.count || 0;
          const share = outcome => total ? (p.outcomes[outcome] / total * 100).toFixed(1) : "0.0";
          flowTip.style("opacity",1).html(`
            <div class="tooltip-title">${p.profile}</div>
            <div class="tooltip-count">${total.toLocaleString()} students</div>
            <div>Graduate: ${p.outcomes.Graduate.toLocaleString()} (${share("Graduate")}%)</div>
            <div>Enrolled: ${p.outcomes.Enrolled.toLocaleString()} (${share("Enrolled")}%)</div>
            <div>Dropout: ${p.outcomes.Dropout.toLocaleString()} (${share("Dropout")}%)</div>
          `);
        } else {
          const total = data.length || 0;
          const count = data.filter(s=>s.Target === d.name).length;
          const share = total ? (count / total * 100).toFixed(1) : "0.0";
          flowTip.style("opacity",1).html(`
            <div class="tooltip-title">${d.name}</div>
            <div class="tooltip-count">${count.toLocaleString()} students</div>
            <div>${share}% of all students</div>
          `);
        }
        moveTip(event,wrap,flowTip);
      })
      .on("mousemove",(event)=>moveTip(event,wrap,flowTip))
      .on("mouseleave",()=>flowTip.style("opacity",0))
      .on("click",(event,d)=>{
        event.stopPropagation();
        const ids=d.stage==="outcome"
          ? new Set(data.filter(s=>s.Target===d.name).map(s=>s.id))
          : new Set(d.profile.students.map(s=>s.id));
        updateTerrainSelection(ids);
        updateSelection(ids.size);
        terrainReadout.html(`<b>${d.stage==="outcome"?d.name:d.name}</b><br>${ids.size.toLocaleString()} students selected`).classed("show",true);
      });

    // Keep Sankey node labels clean: student counts remain available in the hover tooltips.
    g.append("g").selectAll("text").data(graph.nodes).join("text")
      .attr("class","sankey-label")
      .attr("x",d=>d.stage==="outcome"?d.x1+14:d.x0-14)
      .attr("y",d=>(d.y0+d.y1)/2)
      .attr("dy",".35em")
      .attr("text-anchor",d=>d.stage==="outcome"?"start":"end")
      .text(d=>d.name);

    link.attr("stroke-opacity",0).transition().duration(850).delay((d,i)=>Math.min(i*12,500)).attr("stroke-opacity",.24);
    node.attr("opacity",0).transition().duration(550).delay((d,i)=>Math.min(i*25,500)).attr("opacity",1);
  });

  const total=data.length||1;
  const dropout=data.filter(d=>d.Target==="Dropout").length;
  d3.select("#flowSummary").html(`<b>${dropout.toLocaleString()}</b> dropout · ${(dropout/total*100).toFixed(1)}% of selection`);
  d3.select("#flowNote").html(
    `The left profiles combine the two warning dimensions used in the terrain. Ribbon width is the observed number of students ending in each outcome. These patterns show associations observed in the dataset, not causal effects or predictions of individual student outcomes.`
  );
}

function applyFilters({animate=true}={}){
  active=activeData();
  selectedBinKey=null;
  lastFlowSelection=null;
  updateSelection(active.length);
  drawTerrain({animate});
  renderFlow(active);
  terrainReadout.classed("show",false);
}


function init(){
  d3.csv("data/clean_students.csv").then(rows=>{
    students=prepare(rows);
    active=students;
    renderLegend();

    const courses=[...new Map(students.map(s=>[String(s.Course),s.courseName])).entries()]
      .sort((a,b)=>a[1].localeCompare(b[1]));
    courses.forEach(([value,label])=>courseFilter.append("option").attr("value",value).text(label));

    targetFilter.on("change",()=>applyFilters({animate:true}));
    courseFilter.on("change",()=>applyFilters({animate:true}));
    terrainMetric.on("change",()=>drawTerrain({animate:false}));
    zoomBtn.on("click",()=>setZoomEnabled(!zoomEnabled));
    resetBtn.on("click",()=>{
      targetFilter.property("value","All");
      courseFilter.property("value","All");
      terrainMetric.property("value","dropoutRate");
      applyFilters({animate:true});
      if(zoomBehavior) terrainSvg.transition().duration(650).call(zoomBehavior.transform,d3.zoomIdentity);
    });

    window.addEventListener("resize",()=>{drawTerrain({animate:false});renderFlow(active);});
    applyFilters({animate:true});
  }).catch(err=>{
    console.error(err);
    selectionText.text("Could not load data — run the project with a local server.");
  });
}

init();
