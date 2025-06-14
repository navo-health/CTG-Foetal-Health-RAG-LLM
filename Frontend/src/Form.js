import { useState } from 'react';
import { predictFetalHealth } from './services/api';
import './Form.css';

function Form() {
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
   const [result, setResult] = useState(null);

   const handleSubmit = async (event) => {
      event.preventDefault();
    
      setLoading(true);
    
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
    
      try {
        const response = await predictFetalHealth(formData);
        setResult(response);
      } catch (error) {
        console.error('Error:', error);
        setResult({ error: 'Failed to get prediction. Please try again.' });
      } finally {
        setLoading(false);
      }
    };    

   const onChange = (event) => {
      const name = event.target.name;
      const value = event.target.value;
      setForm({ ...form, [name]: value });
   };

   return (
      <form onSubmit={handleSubmit}>
         <h4>Fetal Health Prediction Model</h4>
         <p>CTG Feature Analysis for Fetal Health Assessment</p>

         <div className="form-info">
            <p className="sample-note">
               The form is pre-filled with sample CTG (Cardiotocography) data.
            </p>
         </div>

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

         <div className="form-actions">
            <button type="submit" disabled={loading}>Submit</button>
         </div>

         {loading && <p>Loading...</p>}

         {result && (
            <div className="result">
               <h3>Fetal Health Assessment</h3>
               <div className="prediction-summary">
                  <p><strong>Classification:</strong> {result.prediction}</p>
                  <p><strong>Confidence:</strong> {result.probability}</p>
               </div>
               <div className="clinical-explanation">
                  <h4>Clinical Analysis</h4>
                  <p>{result.message}</p>
               </div>

               {result.relevant_papers && (
                  <div className="papers">
                     <h4>Supporting Research</h4>
                     {result.relevant_papers.map((paper, index) => (
                        <div key={index} className="paper">
                           <h5>{paper.title}</h5>
                           <p>{paper.content}</p>
                           {paper.similarity !== undefined && (
                              <div className="similarity-score">
                                 <i className="fas fa-percentage"></i>
                                 <span>Relevance Score: {paper.similarity}%</span>
                                 <div className="score-bar">
                                    <div
                                       className="score-fill"
                                       style={{
                                          width: String(paper.similarity) + '%',
                                          backgroundColor:
                                             paper.similarity >= 70 ? '#22c55e' :
                                             paper.similarity >= 50 ? '#eab308' :
                                             '#ef4444'
                                       }}
                                    />
                                 </div>
                              </div>
                           )}
                           {paper.relevance_factors && paper.relevance_factors.length > 0 && (
                              <div className="relevance-factors">
                                 <h4>Key Findings:</h4>
                                 <ul>
                                    {paper.relevance_factors.map((factor, index) => (
                                       <li key={index}>
                                          <i className="fas fa-check-circle"></i>
                                          {factor}
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                           )}
                        </div>
                     ))}
                  </div>
               )}
            </div>
         )}
      </form>
   );
}

export default Form;