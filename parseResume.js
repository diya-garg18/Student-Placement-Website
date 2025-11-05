function parseResumeText(text) {
  const lower = text.toLowerCase();
  const skillCandidates = ['react','node','express','postgresql','javascript','typescript','aws','docker'];
  const skills = [];
  for (const s of skillCandidates) if (lower.includes(s)) skills.push(s);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return { skills, sampleLines: lines.slice(0,40) };
}

module.exports = { parseResumeText };
