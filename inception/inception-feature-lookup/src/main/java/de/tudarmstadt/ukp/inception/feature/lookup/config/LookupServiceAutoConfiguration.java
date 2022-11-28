/*
 * Licensed to the Technische Universität Darmstadt under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The Technische Universität Darmstadt 
 * licenses this file to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.
 *  
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package de.tudarmstadt.ukp.inception.feature.lookup.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import de.tudarmstadt.ukp.inception.feature.lookup.LookupCache;
import de.tudarmstadt.ukp.inception.feature.lookup.LookupFeatureSupport;
import de.tudarmstadt.ukp.inception.feature.lookup.LookupService;
import de.tudarmstadt.ukp.inception.feature.lookup.LookupServiceImpl;
import de.tudarmstadt.ukp.inception.feature.lookup.LookupServiceProperties;
import de.tudarmstadt.ukp.inception.feature.lookup.LookupServicePropertiesImpl;

@ConditionalOnProperty(prefix = "annotation.feature-support.lookup", //
        name = "enabled", havingValue = "true", matchIfMissing = false)
@Configuration
@EnableConfigurationProperties({ LookupServicePropertiesImpl.class })
public class LookupServiceAutoConfiguration
{
    @Bean
    public LookupFeatureSupport lookupFeatureSupport(LookupCache aCache)
    {
        return new LookupFeatureSupport(aCache);
    }

    @Bean
    public LookupCache lookupCache(LookupService aLookupService,
            LookupServiceProperties aLookupServiceProperties)
    {
        return new LookupCache(aLookupService, aLookupServiceProperties);
    }

    @Bean
    public LookupService lookupService(LookupServiceProperties aProperties)
    {
        return new LookupServiceImpl(aProperties);
    }
}
