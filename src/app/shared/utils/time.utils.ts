/**
 * Formats seconds into MM:SS format
 */
export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Formats elapsed time given total duration and remaining time
 */
export function formatElapsedTime(totalDuration: number, remainingTime: number): string {
  const elapsed = Math.floor(totalDuration - remainingTime);
  return formatTime(elapsed);
}

/**
 * Calculates progress percentage
 */
export function calculateProgressPercentage(totalTime: number, currentTime: number): number {
  const elapsed = totalTime - currentTime;
  const percentage = (elapsed / totalTime) * 100;
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Formats a date to time string (HH:MM AM/PM)
 */
export function formatTimeString(date: Date): string {
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
}

/**
 * Calculates estimated end time
 */
export function calculateEstimatedEndTime(remainingSeconds: number): Date {
  return new Date(Date.now() + (remainingSeconds * 1000));
}

/**
 * Converts minutes to seconds
 */
export function minutesToSeconds(minutes: number): number {
  return minutes * 60;
}

/**
 * Converts seconds to minutes
 */
export function secondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}