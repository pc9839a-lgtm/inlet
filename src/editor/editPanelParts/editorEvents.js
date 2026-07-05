export function stop(event) {
  event.stopPropagation();
}

export function isActivationKey(event) {
  return event.key === 'Enter' || event.key === ' ';
}