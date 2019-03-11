/*
 * Copyright 2018
 * Ubiquitous Knowledge Processing (UKP) Lab
 * Technische Universität Darmstadt
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.tudarmstadt.ukp.inception.recommendation.sidebar;

import static de.tudarmstadt.ukp.clarin.webanno.support.JSONUtil.fromJsonString;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.MultiValuedMap;
import org.apache.commons.collections4.multimap.ArrayListValuedHashMap;
import org.apache.wicket.feedback.IFeedback;
import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import org.apache.wicket.spring.injection.annot.SpringBean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.wicketstuff.event.annotation.OnEvent;

import de.tudarmstadt.ukp.clarin.webanno.api.annotation.model.AnnotatorState;
import de.tudarmstadt.ukp.clarin.webanno.api.annotation.rendering.event.RenderAnnotationsEvent;
import de.tudarmstadt.ukp.inception.log.EventRepository;
import de.tudarmstadt.ukp.inception.log.model.LoggedEvent;
import de.tudarmstadt.ukp.inception.recommendation.api.RecommendationService;
import de.tudarmstadt.ukp.inception.recommendation.api.model.Recommender;
import de.tudarmstadt.ukp.inception.recommendation.chart.Chart;
import de.tudarmstadt.ukp.inception.recommendation.log.RecommenderEvaluationResultEventAdapter.Details;
import de.tudarmstadt.ukp.inception.recommendation.model.ChartData;

public class LearningCurveChartPanel
    extends Panel
{
    private static final long serialVersionUID = 4306746527837380863L;

    private static final String MID_CHART_CONTAINER = "chart-container";

    private static final Logger LOG = LoggerFactory.getLogger(LearningCurveChartPanel.class);
    
    private final Chart chart;
    private @SpringBean EventRepository eventRepo;
    private @SpringBean RecommendationService recommendationService;

    private final IModel<AnnotatorState> model;
    private final static int MAX_POINTS_TO_PLOT = 50;

    public LearningCurveChartPanel(String aId, IModel<AnnotatorState> aModel)
    {
        super(aId);
        model = aModel;

        chart = new Chart(MID_CHART_CONTAINER, Model.of());
        chart.setOutputMarkupId(true);
        add(chart);
    }

    @OnEvent
    public void onRenderAnnotations(RenderAnnotationsEvent aEvent)
    {
        LOG.trace("rendered annotation event");

        MultiValuedMap<String, Double> recommenderScoreMap = getLatestScores(aEvent);

        if (CollectionUtils.isEmpty(recommenderScoreMap.keys())) {
            LOG.error("No evaluation data for the learning curve. Project: {}",
                    model.getObject().getProject());

            error("Cannot plot the learning curve. Please make some annotations");
            aEvent.getRequestHandler().addChildren(getPage(), IFeedback.class);

            return;
        }

        Map<String,String> curveData = new HashMap<String,String>();
        ChartData learningCurve = new ChartData();

        // iterate over recommenderScoreMap to create data arrays to feed to the c3 graph
        for (String recommenderName : recommenderScoreMap.keySet()) {
        
            
            // extract the scores from the recommenderScoreMao. The value of data calculates to be
            // something like 2,4,6,5,3,9,
            String data = recommenderScoreMap.get(recommenderName).stream().map(Object::toString)
                    .collect(Collectors.joining(", "));
            
            curveData.put(recommenderName,data);
            learningCurve.setCurveData(curveData);
            learningCurve.setMaximumPointsToPlot(MAX_POINTS_TO_PLOT);
            learningCurve.setaRequestHandler(aEvent.getRequestHandler());
        }

        chart.setDefaultModel(Model.of(learningCurve));
    }

    /**
     * Fetches a number of latest evaluation scores from the database and save it in the map
     * corresponding to each recommender for which the scores have been logged in the database
     * 
     * @return
     */
    private MultiValuedMap<String, Double> getLatestScores(RenderAnnotationsEvent aEvent)
    {
        // we want to plot RecommenderEvaluationResultEvent for the learning curve. The
        // value of the event
        String eventType = "RecommenderEvaluationResultEvent";

        List<LoggedEvent> loggedEvents = new ArrayList<LoggedEvent>();
        
        List<Recommender> listEnabledRecommenders = recommendationService
                .listEnabledRecommenders(model.getObject().getProject());
        
        if (listEnabledRecommenders.isEmpty())        {
            LOG.warn("The project has no enabled recommender");

            error("Cannot plot the learning curve. There is not recommender in the project.");

            aEvent.getRequestHandler().addChildren(getPage(), IFeedback.class);
        }
        
        for (Recommender recommender : listEnabledRecommenders) {
            List<LoggedEvent> tempLoggedEvents = eventRepo.listLoggedEvents(
                    model.getObject().getProject(), model.getObject().getUser().getUsername(),
                    eventType, MAX_POINTS_TO_PLOT, recommender.getId());
            
            // we want to show the latest record on the right side of the graph
            Collections.reverse(tempLoggedEvents);
            
            loggedEvents.addAll(tempLoggedEvents);
        }
                
        if (CollectionUtils.isEmpty(loggedEvents)) {
            return new ArrayListValuedHashMap<String, Double>();
        }

        MultiValuedMap<String, Double> recommenderScoreMap = new ArrayListValuedHashMap<>();

        // iterate over the logged events to extract the scores and map it against its corresponding
        // recommender.
        for (LoggedEvent loggedEvent : loggedEvents) {
            String detailJson = loggedEvent.getDetails();
            try {
                Details detail = fromJsonString(Details.class, detailJson);

                //do not include the scores from disabled recommenders
                List<Recommender> recommenderIfActive = recommendationService
                        .getEnabledRecommenders(detail.recommenderId);
                if (recommenderIfActive.isEmpty()) {
                    continue;
                }

                // sometimes score values NaN. Can result into error while rendering the graph on UI
                if (!Double.isFinite(detail.score)) {
                    continue;
                }
                
                //recommenderIfActive only has one member
                recommenderScoreMap.put(recommenderIfActive.get(0).getName(), detail.score);
            }
            catch (IOException e) {
                LOG.error("Invalid logged Event detail. Skipping record with logged event id: "
                        + loggedEvent.getId(), e);

                error("Invalid logged Event detail. Skipping record with logged event id: "
                        + loggedEvent.getId());

                aEvent.getRequestHandler().addChildren(getPage(), IFeedback.class);
            }
        }
        return recommenderScoreMap;
    }
    
}

