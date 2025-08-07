import { useState, useCallback } from 'react';
import { predictFetalHealth } from './services/api';
import './Form.css';

function Form({ onAnalysisComplete, onAnalysisStart, darkMode }) {
   const [form, setForm] = useState({
      baseline_value: "120",
      accelerations: "0",
      fetal_movement: "0",
      uterine_contractions: "0",
      light_decelerations: "0",
      severe_decelerations: "0",
      prolongued_decelerations: "0",
      abnormal_short_term_variability: "73",
      mean_value_of_short_term_variability: "0.5",
      percentage_of_time_with_abnormal_long_term_variability: "43",
      mean_value_of_long_term_variability: "2.4",
      histogram_width: "64",
      histogram_min: "62",
      histogram_max: "126",
      histogram_number_of_peaks: "2",
      histogram_number_of_zeroes: "0",
      histogram_mode: "120",
      histogram_mean: "137",
      histogram_median: "121",
      histogram_variance: "73",
      histogram_tendency: "1"
   });

   const [loading, setLoading] = useState(false);
   const [error, setError] = useState(null);
   const [isDragging, setIsDragging] = useState(false);
   const [showForm, setShowForm] = useState(false);

   const handleSubmit = useCallback(async (formData) => {
      setLoading(true);
      setError(null);
      onAnalysisStart();

      try {
        const response = await predictFetalHealth(formData);
        onAnalysisComplete(response);
      } catch (error) {
        console.error('Error:', error);
        if (error.message && error.message.includes('Maximum allowed size')) {
          setError(error.message);
        } else if (error.message && error.message.includes('Rate limit')) {
          setError(error.message);
        } else {
          setError('Failed to get prediction. Please try again.');
        }
      } finally {
        setLoading(false);
      }
   }, [onAnalysisComplete, onAnalysisStart]);

   const onChange = (event) => {
      const name = event.target.name;
      const value = event.target.value;
      setForm({ ...form, [name]: value });
   };

   const processCSVData = useCallback((csvData) => {
      try {
         const lines = csvData.split('\n');
         if (lines.length < 2) {
            throw new Error('CSV file must contain at least a header and one data row');
         }

         const headers = lines[0].split(',').map(header => header.trim());
         const values = lines[1].split(',').map(value => value.trim());

         const newFormData = {};
         headers.forEach((header, index) => {
            if (header !== 'fetal_health') { // Skip the target column
               const formKey = header.replace(/\s+/g, '_').toLowerCase();
               if (formKey in form) {
                  newFormData[formKey] = values[index];
               }
            }
         });

         setForm(newFormData);
         setShowForm(true);
         return newFormData;
      } catch (error) {
         console.error('Error processing CSV:', error);
         setError('Invalid CSV format. Please check the file structure.');
         return null;
      }
   }, [form]);

   const handleDragOver = useCallback((e) => {
      e.preventDefault();
      setIsDragging(true);
   }, []);

   const handleDragLeave = useCallback((e) => {
      e.preventDefault();
      setIsDragging(false);
   }, []);

   const downloadSampleData = (filename) => {
      const link = document.createElement('a');
      link.href = `${process.env.PUBLIC_URL}/${filename}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const handleDrop = useCallback(async (e) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'text/csv') {
         const reader = new FileReader();
         reader.onload = async (event) => {
            const csvData = event.target.result;
            const newFormData = processCSVData(csvData);
            if (newFormData) {
               const formData = {
                  "baseline value": parseFloat(newFormData.baseline_value),
                  "accelerations": parseFloat(newFormData.accelerations),
                  "fetal_movement": parseFloat(newFormData.fetal_movement),
                  "uterine_contractions": parseFloat(newFormData.uterine_contractions),
                  "light_decelerations": parseFloat(newFormData.light_decelerations),
                  "severe_decelerations": parseFloat(newFormData.severe_decelerations),
                  "prolongued_decelerations": parseFloat(newFormData.prolongued_decelerations),
                  "abnormal_short_term_variability": parseFloat(newFormData.abnormal_short_term_variability),
                  "mean_value_of_short_term_variability": parseFloat(newFormData.mean_value_of_short_term_variability),
                  "percentage_of_time_with_abnormal_long_term_variability": parseFloat(newFormData.percentage_of_time_with_abnormal_long_term_variability),
                  "mean_value_of_long_term_variability": parseFloat(newFormData.mean_value_of_long_term_variability),
                  "histogram_width": parseFloat(newFormData.histogram_width),
                  "histogram_min": parseFloat(newFormData.histogram_min),
                  "histogram_max": parseFloat(newFormData.histogram_max),
                  "histogram_number_of_peaks": parseFloat(newFormData.histogram_number_of_peaks),
                  "histogram_number_of_zeroes": parseFloat(newFormData.histogram_number_of_zeroes),
                  "histogram_mode": parseFloat(newFormData.histogram_mode),
                  "histogram_mean": parseFloat(newFormData.histogram_mean),
                  "histogram_median": parseFloat(newFormData.histogram_median),
                  "histogram_variance": parseFloat(newFormData.histogram_variance),
                  "histogram_tendency": parseFloat(newFormData.histogram_tendency),
               };
               await handleSubmit(formData);
            }
         };
         reader.readAsText(file);
      } else {
         setError('Please drop a valid CSV file');
      }
   }, [processCSVData, handleSubmit]);

   return (
      <form 
         onSubmit={(e) => {
            e.preventDefault();
            const formData = {
               "baseline value": parseFloat(form.baseline_value),
               "accelerations": parseFloat(form.accelerations),
               "fetal_movement": parseFloat(form.fetal_movement),
               "uterine_contractions": parseFloat(form.uterine_contractions),
               "light_decelerations": parseFloat(form.light_decelerations),
               "severe_decelerations": parseFloat(form.severe_decelerations),
               "prolongued_decelerations": parseFloat(form.prolongued_decelerations),
               "abnormal_short_term_variability": parseFloat(form.abnormal_short_term_variability),
               "mean_value_of_short_term_variability": parseFloat(form.mean_value_of_short_term_variability),
               "percentage_of_time_with_abnormal_long_term_variability": parseFloat(form.percentage_of_time_with_abnormal_long_term_variability),
               "mean_value_of_long_term_variability": parseFloat(form.mean_value_of_long_term_variability),
               "histogram_width": parseFloat(form.histogram_width),
               "histogram_min": parseFloat(form.histogram_min),
               "histogram_max": parseFloat(form.histogram_max),
               "histogram_number_of_peaks": parseFloat(form.histogram_number_of_peaks),
               "histogram_number_of_zeroes": parseFloat(form.histogram_number_of_zeroes),
               "histogram_mode": parseFloat(form.histogram_mode),
               "histogram_mean": parseFloat(form.histogram_mean),
               "histogram_median": parseFloat(form.histogram_median),
               "histogram_variance": parseFloat(form.histogram_variance),
               "histogram_tendency": parseFloat(form.histogram_tendency),
            };
            handleSubmit(formData);
         }}
         className={`upload-form${isDragging ? ' dragging' : ''}${darkMode ? ' dark' : ''}`}
         onDragOver={handleDragOver}
         onDragLeave={handleDragLeave}
         onDrop={handleDrop}
      >
         <div className="form-info">
            <p className="form-description">
               <span onClick={() => downloadSampleData('ctg_data_1.csv')}>Normal</span>, <span onClick={() => downloadSampleData('ctg_data_2.csv')}>Suspicious</span>, <span onClick={() => downloadSampleData('ctg_data_3.csv')}>Pathological</span> CSV data samples.
               <br />
               <strong>Drag and drop a CSV (Comma-Separated Values) file with CTG data to generate fetal health analysis report.</strong>
            </p>
         </div>

         <div className={`form-grid ${showForm ? 'visible' : 'hidden'}`}>
            <div className="form-group">
               <label htmlFor="baseline_value">Baseline Value (FHR)</label>
               <input type="number" id="baseline_value" name="baseline_value" value={form.baseline_value} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="accelerations">Number of Accelerations</label>
               <input type="number" id="accelerations" name="accelerations" value={form.accelerations} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="fetal_movement">Fetal Movement</label>
               <input type="number" id="fetal_movement" name="fetal_movement" value={form.fetal_movement} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="uterine_contractions">Uterine Contractions</label>
               <input type="number" id="uterine_contractions" name="uterine_contractions" value={form.uterine_contractions} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="light_decelerations">Light Decelerations</label>
               <input type="number" id="light_decelerations" name="light_decelerations" value={form.light_decelerations} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="severe_decelerations">Severe Decelerations</label>
               <input type="number" id="severe_decelerations" name="severe_decelerations" value={form.severe_decelerations} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="prolongued_decelerations">Prolonged Decelerations</label>
               <input type="number" id="prolongued_decelerations" name="prolongued_decelerations" value={form.prolongued_decelerations} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="abnormal_short_term_variability">Abnormal Short-term Variability</label>
               <input type="number" id="abnormal_short_term_variability" name="abnormal_short_term_variability" value={form.abnormal_short_term_variability} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="mean_value_of_short_term_variability">Mean Short-term Variability</label>
               <input type="number" id="mean_value_of_short_term_variability" name="mean_value_of_short_term_variability" value={form.mean_value_of_short_term_variability} onChange={onChange} required step="0.1" />
            </div>

            <div className="form-group">
               <label htmlFor="percentage_of_time_with_abnormal_long_term_variability">% Time with Abnormal Long-term Variability</label>
               <input type="number" id="percentage_of_time_with_abnormal_long_term_variability" name="percentage_of_time_with_abnormal_long_term_variability" value={form.percentage_of_time_with_abnormal_long_term_variability} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="mean_value_of_long_term_variability">Mean Long-term Variability</label>
               <input type="number" id="mean_value_of_long_term_variability" name="mean_value_of_long_term_variability" value={form.mean_value_of_long_term_variability} onChange={onChange} required step="0.1" />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_width">Histogram Width</label>
               <input type="number" id="histogram_width" name="histogram_width" value={form.histogram_width} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_min">Histogram Minimum</label>
               <input type="number" id="histogram_min" name="histogram_min" value={form.histogram_min} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_max">Histogram Maximum</label>
               <input type="number" id="histogram_max" name="histogram_max" value={form.histogram_max} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_number_of_peaks">Histogram Number of Peaks</label>
               <input type="number" id="histogram_number_of_peaks" name="histogram_number_of_peaks" value={form.histogram_number_of_peaks} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_number_of_zeroes">Histogram Number of Zeroes</label>
               <input type="number" id="histogram_number_of_zeroes" name="histogram_number_of_zeroes" value={form.histogram_number_of_zeroes} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_mode">Histogram Mode</label>
               <input type="number" id="histogram_mode" name="histogram_mode" value={form.histogram_mode} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_mean">Histogram Mean</label>
               <input type="number" id="histogram_mean" name="histogram_mean" value={form.histogram_mean} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_median">Histogram Median</label>
               <input type="number" id="histogram_median" name="histogram_median" value={form.histogram_median} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_variance">Histogram Variance</label>
               <input type="number" id="histogram_variance" name="histogram_variance" value={form.histogram_variance} onChange={onChange} required />
            </div>

            <div className="form-group">
               <label htmlFor="histogram_tendency">Histogram Tendency</label>
               <input type="number" id="histogram_tendency" name="histogram_tendency" value={form.histogram_tendency} onChange={onChange} required />
            </div>
         </div>

         <div className="form-actions hidden">
            <button type="submit" className="submit-button" disabled={loading}>
               {loading ? 'Analyzing...' : 'Analyze Fetal Health'}
            </button>
         </div>

         {error && (
            <div className="error-message">
               {error}
            </div>
         )}
      </form>
   );
}

export default Form;