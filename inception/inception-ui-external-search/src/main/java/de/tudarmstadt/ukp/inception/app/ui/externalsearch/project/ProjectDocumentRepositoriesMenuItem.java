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
package de.tudarmstadt.ukp.inception.app.ui.externalsearch.project;

import org.apache.wicket.Page;
import org.apache.wicket.model.StringResourceModel;
import org.springframework.core.annotation.Order;

import de.agilecoders.wicket.core.markup.html.bootstrap.image.IconType;
import de.agilecoders.wicket.extensions.markup.html.bootstrap.icon.FontAwesome5IconType;
import de.tudarmstadt.ukp.inception.app.ui.externalsearch.config.ExternalSearchUIAutoConfiguration;
import de.tudarmstadt.ukp.inception.ui.core.dashboard.settings.ProjectSettingsMenuItemBase;

/**
 * Project settings panel to configure document repositories for the external search.
 * <p>
 * This class is exposed as a Spring Component via
 * {@link ExternalSearchUIAutoConfiguration#projectDocumentRepositoriesMenuItem}.
 * </p>
 */
@Order(DocumentRepositoryProjectSettingsPanelFactory.ORDER)
public class ProjectDocumentRepositoriesMenuItem
    extends ProjectSettingsMenuItemBase
{
    @Override
    public String getPath()
    {
        return "/settings/repositories";
    }

    @Override
    public IconType getIcon()
    {
        return FontAwesome5IconType.database_s;
    }

    @Override
    public String getLabel()
    {
        // IRequestablePage currentPage =
        // PageRequestHandlerTracker.getLastHandler(RequestCycle.get())
        // .getPage();
        //
        // return new StringResourceModel("projectdocumentrepositories.menuitem.label",
        // new ProjectDocumentRepositoriesPage(currentPage.getPageParameters())).getString();

        return new StringResourceModel("projectdocumentrepositories.menuitem.label").getString();
    }

    @Override
    public Class<? extends Page> getPageClass()
    {
        return ProjectDocumentRepositoriesPage.class;
    }
}
