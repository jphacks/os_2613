export function cueSearch(cue) {
  const text = `${cue.label ?? ''} ${cue.query}`;
  if (/平手|頬|slap/i.test(text)) return 'slap face';
  if (/殴|一撃|punch/i.test(text)) return 'punch body impact';
  if (/地団駄|踏み鳴ら|stomp/i.test(text)) return 'foot stomp';
  if (/棍棒|棒を振|club swing/i.test(text)) return 'stick swing whoosh';
  if (/縄|rope|結ぶ|縛る/i.test(text)) return 'rope handling';
  if (/かき分け|pushing movement|parting movement/i.test(text)) return 'crowd movement';
  if (/小川|飛び越|stream splash/i.test(text)) return 'splashing footsteps';
  if (/疾走|足音|走る|駆け|running|footsteps/i.test(text)) return 'running footsteps';
  if (/拍手|歓声|どよめ|crowd|applause|cheer/i.test(text)) return /拍手|applause/i.test(text) ? 'crowd applause' : 'crowd cheering';
  if (/雨|rain/i.test(text)) return 'rain ambience';
  if (/濁流|川|river/i.test(text) && cue.mode === 'loop') return 'river flowing water';
  return cue.query;
}
export function preferredCueTrack(cue, tracks) {
  const words = cueSearch(cue).split(' ').filter(word => word.length > 2);
  const score = track => {
    const name = (track.name ?? '').toLowerCase();
    const matches = words.filter(word => name.includes(word)).length;
    const metadata = `${name} ${(track.tags ?? []).join(' ')}`;
    if (/地団駄|踏み鳴ら|stomp/i.test(`${cue.label} ${cue.query}`) && !/stomp|footstep|walking/i.test(metadata)) return -100;
    if (/棍棒|棒を振|club swing/i.test(`${cue.label} ${cue.query}`) && (!/swing|whoosh|swish/i.test(metadata) || /golf/i.test(metadata))) return -100;
    if (/slap|平手|頬/i.test(`${cue.label} ${cue.query}`) && !/slap|smack/i.test(metadata)) return -100;
    if (/殴|一撃|punch/i.test(`${cue.label} ${cue.query}`) && !/punch|impact|hit|thud/i.test(metadata)) return -100;
    if (/雨|rain/i.test(`${cue.label} ${cue.query}`) && !/rain|raindrop|shower|downpour/i.test(metadata)
      && !(/疾走|足音|走る|駆け|running|footsteps/i.test(`${cue.label} ${cue.query}`) && /footstep|walking|running/i.test(metadata))) return -100;
    if (/濁流|川|river/i.test(`${cue.label} ${cue.query}`) && cue.mode === 'loop' && !/river|stream|water|rapids/i.test(metadata)) return -100;
    if (/拍手|applause/i.test(`${cue.label} ${cue.query}`) && !/applause|clap|audience/i.test(metadata)) return -100;
    if (/歓声|どよめ|crowd|cheer/i.test(`${cue.label} ${cue.query}`) && cue.mode === 'loop' && !/crowd|audience|applause|cheer|murmur/i.test(metadata)) return -100;
    if (/punch|slap/.test(words.join(' ')) && /metal|belt|ringout/.test(name)) return -100;
    return matches * 3;
  };
  const compatible = tracks.filter(track => score(track) >= 0);
  return compatible.reduce((best, track) => !best || (track.id === cue.selectedId && score(track) === score(best)) || score(track) > score(best) ? track : best, null);
}

export function audibleCue(cue) {
  const text = `${cue.label ?? ''} ${cue.query ?? ''}`;
  return !/雨が止|rain stopping|抱擁|抱き合|embrace|hug|マントを差し出|cloth offered/i.test(text);
}
