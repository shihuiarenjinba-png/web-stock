export const FREE_MAX_FILE_BYTES=500*1024;
export const FREE_MAX_PERIODS=100;
export const FREE_MAX_SERIES=2;

export function freeFileIssue(file){
 if(!file)return null;
 if(Number(file.size)>FREE_MAX_FILE_BYTES)return 'file_size';
 return null;
}
export function freeSeriesIssue(series){
 if(!Array.isArray(series))return 'series_invalid';
 if(series.length>FREE_MAX_SERIES)return 'series_count';
 if(series.some(s=>!Array.isArray(s?.values)||s.values.length>FREE_MAX_PERIODS))return 'period_count';
 return null;
}
export function freeManualIssue(values){
 if(!Array.isArray(values))return 'series_invalid';
 return values.length>FREE_MAX_PERIODS?'period_count':null;
}
