// screens/GlucoSwapScreen.web.tsx
// Replaced Alert.alert with window.confirm and window.alert for web compatibility.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  // Alert, // Removed Alert import
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CONVERSION_FACTOR = 18.0182;
const HISTORY_STORAGE_KEY = '@glucoSwapHistory';
const MAX_HISTORY_ITEMS_DISPLAYED = 100;
const MAX_HISTORY_ITEMS_RENDERED = 20;
const MAX_INPUT_LENGTH = 5;
const HISTORY_ITEM_APPROX_HEIGHT = 55;
const HISTORY_MAX_VISIBLE_ITEMS = 4;
const MIN_POINTS_FOR_CHART = 2;
const MAX_CHART_LABELS = 6;

type Unit = 'mg/dL' | 'mmol/L';

interface HistoryItem {
  id: string;
  timestamp: number;
  mgdlValue: number;
  mmolValue: number;
}

interface ChartDataPoint {
    timestamp: number;
    timeLabel: string;
    mgdlValue: number;
    mmolValue: number;
    yValue: number;
}

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const scale = (size: number): number => (width / guidelineBaseWidth) * size;
const moderateScale = (size: number, factor = 0.5): number => size + (scale(size) - size) * factor;

export default function GlucoSwapScreenWeb() {
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<Unit>('mg/dL');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsHistoryLoading(true);
    try {
      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory !== null) {
        const parsedHistory = JSON.parse(storedHistory) as HistoryItem[];
        if (Array.isArray(parsedHistory)) {
           setHistory(parsedHistory.slice(0, MAX_HISTORY_ITEMS_DISPLAYED));
        } else {
           setHistory([]);
           localStorage.removeItem(HISTORY_STORAGE_KEY);
        }
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error('Failed to load history from localStorage.', e);
      // Use window.alert for errors too if Alert wasn't working
      window.alert('Error: Could not load conversion history.');
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isHistoryLoading) {
      try {
        const historyToSave = history.slice(0, MAX_HISTORY_ITEMS_DISPLAYED);
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyToSave));
      } catch (e) {
        console.error('Failed to save history to localStorage.', e);
         // Use window.alert for warnings too
        window.alert('Warning: Could not save conversion history. Storage might be full.');
      }
    }
  }, [history, isHistoryLoading]);

  const formatTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).replace(',', '');
  }, []);

  const formatTimestampForChart = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, []);

  const isInputValid = useMemo(() => {
    const numericValue = parseFloat(inputValue);
    return !isNaN(numericValue) && numericValue > 0;
  }, [inputValue]);

  const handleUnitChange = (newUnit: Unit) => {
    setSelectedUnit(newUnit);
    setInputValue('');
  };

  const handleConvert = useCallback(() => {
    if (!isInputValid) return;

    const value = parseFloat(inputValue);
    let mgdlValue: number;
    let mmolValue: number;
    let resultText: string;

    if (selectedUnit === 'mg/dL') {
      mgdlValue = value;
      mmolValue = value / CONVERSION_FACTOR;
      resultText = `${mgdlValue.toFixed(0)} mg/dL ≈ ${mmolValue.toFixed(2)} mmol/L`;
    } else {
      mmolValue = value;
      mgdlValue = value * CONVERSION_FACTOR;
      resultText = `${mmolValue.toFixed(2)} mmol/L ≈ ${mgdlValue.toFixed(0)} mg/dL`;
    }

    const newEntry: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mgdlValue: mgdlValue,
      mmolValue: mmolValue,
    };

    setHistory(prevHistory => [newEntry, ...prevHistory].slice(0, MAX_HISTORY_ITEMS_DISPLAYED));

    // Use window.alert to show the result
    window.alert(resultText);
    // Clear input after the alert is dismissed
    setInputValue('');

  }, [inputValue, selectedUnit, isInputValid]);

  const handleClearHistory = useCallback(() => {
    // Use window.confirm for confirmation
    const userConfirmed = window.confirm(
      'Are you sure you want to delete all conversion history? This action cannot be undone.'
    );

    // Proceed only if the user clicked "OK"
    if (userConfirmed) {
      setHistory([]);
      setInputValue('');
      try {
          localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch (e) {
          console.error("Failed to clear history from localStorage.", e);
          // Optionally alert the user about the failure
          window.alert("Error: Could not clear history from storage.");
      }
    }
  }, []); // No dependencies needed

  const renderHistoryItem = (item: HistoryItem) => (
    <View key={item.id} style={styles.historyItem}>
      <Text style={styles.historyTextTime} numberOfLines={1} ellipsizeMode="tail">
        {formatTimestamp(item.timestamp)}
      </Text>
      <Text style={styles.historyTextValue}>{item.mgdlValue.toFixed(0)}</Text>
      <Text style={styles.historyTextValue}>{item.mmolValue.toFixed(2)}</Text>
    </View>
  );

  const historyListMaxHeight = useMemo(() => {
      return (HISTORY_ITEM_APPROX_HEIGHT * HISTORY_MAX_VISIBLE_ITEMS) + moderateScale(30);
  }, []);

  const chartYUnit: Unit = selectedUnit === 'mg/dL' ? 'mmol/L' : 'mg/dL';
  const chartYAxisSuffix = chartYUnit === 'mg/dL' ? ' mg/dL' : ' mmol/L';
  const chartTitleText = `Glucose Trend (${chartYUnit})`;
  const chartDecimalPlaces = chartYUnit === 'mg/dL' ? 0 : 1;

  const rechartsData = useMemo((): ChartDataPoint[] | null => {
    if (history.length < MIN_POINTS_FOR_CHART) {
      return null;
    }
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

    return sortedHistory.map(item => ({
      timestamp: item.timestamp,
      timeLabel: formatTimestampForChart(item.timestamp),
      mgdlValue: item.mgdlValue,
      mmolValue: item.mmolValue,
      yValue: chartYUnit === 'mg/dL' ? item.mgdlValue : item.mmolValue,
    }));
  }, [history, formatTimestampForChart, chartYUnit]);

  return (
    <View style={styles.webContainer}>
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.title}>GlucoSwap</Text>
          <View style={styles.section}>
            <Text style={styles.label}>Convert From:</Text>
            <View style={styles.radioContainer}>
               <TouchableOpacity
                 style={styles.radioButton}
                 onPress={() => handleUnitChange('mg/dL')}
                 activeOpacity={0.7}
               >
                 <View style={[styles.radioOuter, selectedUnit === 'mg/dL' && styles.radioOuterSelected]}>
                   {selectedUnit === 'mg/dL' && <View style={styles.radioInnerSelected} />}
                 </View>
                 <Text style={styles.radioLabel}>mg/dL</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={styles.radioButton}
                 onPress={() => handleUnitChange('mmol/L')}
                 activeOpacity={0.7}
               >
                 <View style={[styles.radioOuter, selectedUnit === 'mmol/L' && styles.radioOuterSelected]}>
                   {selectedUnit === 'mmol/L' && <View style={styles.radioInnerSelected} />}
                 </View>
                 <Text style={styles.radioLabel}>mmol/L</Text>
               </TouchableOpacity>
            </View>
          </View>
          <View style={styles.section}>
             <Text style={styles.label}>Enter Value:</Text>
             <TextInput
               style={styles.input}
               placeholder={`Enter ${selectedUnit} value`}
               placeholderTextColor="#888"
               keyboardType="numeric"
               value={inputValue}
               onChangeText={setInputValue}
               maxLength={MAX_INPUT_LENGTH}
               autoCorrect={false}
               spellCheck={false}
             />
           </View>
           <TouchableOpacity
             style={[styles.convertButton, !isInputValid && styles.convertButtonDisabled]}
             onPress={handleConvert}
             disabled={!isInputValid}
             activeOpacity={isInputValid ? 0.8 : 1.0}
           >
             <Text style={styles.convertButtonText}>Convert</Text>
           </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.historyCard]}>
           <View style={styles.historyHeader}>
             <Text style={styles.historyTitle}>Conversion History</Text>
             {!isHistoryLoading && history.length > 0 && (
               <TouchableOpacity onPress={handleClearHistory} style={styles.clearButton} activeOpacity={0.7}>
                 <Text style={styles.clearButtonText}>Clear</Text>
               </TouchableOpacity>
             )}
           </View>
           <View style={[styles.historyListContainer, { maxHeight: historyListMaxHeight }]}>
             {isHistoryLoading ? (
               <ActivityIndicator size="large" color="#8A2BE2" style={styles.loadingIndicator} />
             ) : history.length === 0 ? (
               <View style={styles.noHistoryContainer}>
                 <Text style={styles.noHistoryText}>No conversions recorded yet.</Text>
               </View>
             ) : (
               <ScrollView style={styles.innerHistoryScroll}>
                  <View style={styles.historyItemHeader}>
                     <Text style={[styles.historyHeaderText, styles.historyHeaderTextTime]}>Time</Text>
                     <Text style={styles.historyHeaderText}>mg/dL</Text>
                     <Text style={styles.historyHeaderText}>mmol/L</Text>
                   </View>
                 {history.slice(0, MAX_HISTORY_ITEMS_RENDERED).map(item => renderHistoryItem(item))}
               </ScrollView>
             )}
           </View>
         </View>

        {!isHistoryLoading && rechartsData && (
            <View style={styles.card}>
              <Text style={styles.chartTitle}>{chartTitleText}</Text>
              <View style={styles.chartContainer}>
                <ResponsiveContainer width="100%" height={moderateScale(280)}>
                  <LineChart
                    data={rechartsData}
                    margin={{ top: 5, right: 15, left: -15, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                        dataKey="timeLabel"
                        stroke="#CCC"
                        angle={-15}
                        textAnchor="end"
                        height={40}
                        tick={{ fontSize: moderateScale(10) }}
                     />
                    <YAxis
                        stroke="#CCC"
                        tickFormatter={(value) => value.toFixed(chartDecimalPlaces)}
                        domain={['auto', 'auto']}
                        tick={{ fontSize: moderateScale(10) }}
                     />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#2C2C3E', border: 'none', borderRadius: moderateScale(5)}}
                      labelStyle={{ color: '#DDD', fontWeight: 'bold' }}
                      itemStyle={{ color: '#FFF' }}
                      formatter={(value: number) => [value.toFixed(chartDecimalPlaces), chartYUnit]}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend wrapperStyle={{ paddingTop: 20 }}/>
                    <Line
                      type="monotone"
                      dataKey="yValue"
                      stroke="#8A2BE2"
                      strokeWidth={3}
                      activeDot={{ r: 6, stroke: "#A040FF", strokeWidth: 2 }}
                      dot={{ r: 4, stroke: "#A040FF", fill: '#1E1E2E', strokeWidth: 2 }}
                      name={chartYUnit}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </View>
            </View>
          )}
         {!isHistoryLoading && history.length < MIN_POINTS_FOR_CHART && (
             <View style={styles.card}>
               <Text style={styles.noHistoryText}>Need at least {MIN_POINTS_FOR_CHART} history entries to display chart.</Text>
             </View>
           )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
      flex: 1,
      backgroundColor: '#121212',
      height: '100%',
      overflow: 'hidden',
  },
  scrollView: {
      flex: 1,
      width: '100%',
      height: '100%',
  },
  container: {
      paddingTop: height * 0.05,
      paddingBottom: height * 0.05,
      paddingHorizontal: '5%',
      backgroundColor: '#121212',
      alignItems: 'center',
      minHeight: '95%',
  },
  card: {
      backgroundColor: '#1E1E2E',
      borderRadius: moderateScale(12),
      padding: '5%',
      marginBottom: height * 0.03,
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
      width: '95%',
      maxWidth: 600,
      borderWidth: 1,
      borderColor: '#9370DB',
      alignSelf: 'center',
  },
  title: {
      fontSize: moderateScale(28, 0.4),
      fontWeight: 'bold',
      color: '#FFF',
      textAlign: 'center',
      marginBottom: height * 0.03,
  },
  section: {
      marginBottom: height * 0.025,
  },
  label: {
      fontSize: moderateScale(16, 0.3),
      color: '#DDD',
      marginBottom: height * 0.01,
      fontWeight: '500',
  },
  radioContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
  },
  radioButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: width * 0.08,
      paddingVertical: height * 0.005,
      cursor: 'pointer',
  },
  radioOuter: {
      width: moderateScale(20),
      height: moderateScale(20),
      borderRadius: moderateScale(10),
      borderWidth: 2,
      borderColor: '#8A2BE2',
      marginRight: width * 0.02,
      justifyContent: 'center',
      alignItems: 'center',
  },
  radioOuterSelected: {
      borderColor: '#A040FF',
  },
  radioInnerSelected: {
      width: moderateScale(10),
      height: moderateScale(10),
      borderRadius: moderateScale(5),
      backgroundColor: '#8A2BE2',
  },
  radioLabel: {
      fontSize: moderateScale(16, 0.3),
      color: '#FFF',
  },
  input: {
      backgroundColor: '#2C2C3E',
      color: '#FFF',
      paddingHorizontal: width * 0.04,
      paddingVertical: height * 0.015,
      borderRadius: moderateScale(8),
      fontSize: moderateScale(16, 0.3),
      borderWidth: 1,
      borderColor: '#BDB0D0',
      width: '100%',
  },
  convertButton: {
      backgroundColor: '#8A2BE2',
      paddingVertical: height * 0.018,
      borderRadius: moderateScale(8),
      alignItems: 'center',
      marginTop: height * 0.01,
      opacity: 1,
      cursor: 'pointer',
  },
  convertButtonDisabled: {
      backgroundColor: '#5A1D9A',
      opacity: 0.6,
      cursor: 'not-allowed',
  },
  convertButtonText: {
      color: '#FFF',
      fontSize: moderateScale(16, 0.3),
      fontWeight: 'bold',
  },
  historyCard: {
      paddingBottom: '3%',
      flexShrink: 1,
  },
  historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: height * 0.015,
      borderBottomWidth: 1,
      borderBottomColor: '#444',
      marginBottom: height * 0.01,
  },
  historyTitle: {
      fontSize: moderateScale(24, 0.4),
      fontWeight: 'bold',
      color: '#DDD',
  },
  clearButton: {
      paddingVertical: moderateScale(4),
      paddingHorizontal: moderateScale(10),
      borderRadius: moderateScale(5),
      backgroundColor: '#333',
      cursor: 'pointer',
  },
  clearButtonText: {
      color: '#FF6B6B',
      fontSize: moderateScale(14, 0.3),
      fontWeight: 'bold',
  },
  historyListContainer: {
      overflow: 'hidden',
  },
  innerHistoryScroll: {

  },
  loadingIndicator: {
      marginTop: height * 0.05,
      paddingVertical: moderateScale(20),
  },
  noHistoryContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: moderateScale(30),
  },
  noHistoryText: {
      color: '#AAA',
      textAlign: 'center',
      fontSize: moderateScale(16, 0.3),
      fontStyle: 'italic',
  },
  historyItemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: height * 0.01,
      paddingHorizontal: '1%',
      backgroundColor: '#1E1E2E',
      borderBottomWidth: 1,
      borderBottomColor: '#444',
      marginBottom: 5,
  },
  historyHeaderText: {
      color: '#BBB',
      fontWeight: 'bold',
      fontSize: moderateScale(14, 0.3),
      flex: 1,
      textAlign: 'left',
      paddingHorizontal: moderateScale(2),
  },
  historyHeaderTextTime: {
      flex: 1.5,
  },
  historyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: height * 0.015,
      paddingHorizontal: '1%',
      borderBottomWidth: 1,
      borderBottomColor: '#3a3a4a',
      minHeight: HISTORY_ITEM_APPROX_HEIGHT - moderateScale(10),
  },
  historyTextTime: {
      color: '#CCC',
      fontSize: moderateScale(13, 0.3),
      flex: 1.5,
      textAlign: 'left',
      paddingRight: moderateScale(5),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
  },
  historyTextValue: {
      color: '#FFF',
      fontSize: moderateScale(14, 0.3),
      flex: 1,
      textAlign: 'left',
      paddingHorizontal: moderateScale(2),
  },
  chartTitle: {
      fontSize: moderateScale(18, 0.3),
      fontWeight: 'bold',
      color: '#DDD',
      textAlign: 'center',
      marginBottom: height * 0.02,
  },
  chartContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: moderateScale(280),
  },
});
